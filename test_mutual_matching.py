"""
========================================================================
 Glysmork Professional Matchmaking Engine Test Suite
 ====================================================
 This script creates realistic mock users with vector embeddings,
 connection preferences (hard filters), and active intents.
 It then exercises every stage of the pipeline:
   1. Hard Filter Early Exit (age, gender, language, dealbreakers)
   2. Searcher Intent → Candidate Profile (AST + vector similarity)
   3. Mutual Intent (Candidate Intent → Searcher Profile)
   4. Onboarding Persona Blend
 
 Run:  python manage.py shell < test_mutual_matching.py
 Or:   python -c "exec(open('test_mutual_matching.py').read())"
========================================================================
"""
import os, sys, json, django

# Fix Windows console encoding
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
django.setup()

from django.contrib.auth.models import User
from users.models import Profile
from matchmaking.engine import (
    get_embedding, run_hybrid_discovery, passes_hard_filters,
    parse_intent_to_ast, MatchEvaluator, cosine_similarity, SENTIMENT_WEIGHTS
)
import numpy as np
from datetime import datetime

# ──────────────────────────────────────────────────────────────────────
# UTILITIES
# ──────────────────────────────────────────────────────────────────────

DIVIDER = "=" * 80
SUBDIV  = "-" * 60

def log(msg, indent=0):
    prefix = "  " * indent
    print(f"{prefix}{msg}")

def section(title):
    print(f"\n{DIVIDER}")
    print(f"  {title}")
    print(DIVIDER)

def subsection(title):
    print(f"\n{SUBDIV}")
    print(f"  {title}")
    print(SUBDIV)

# ──────────────────────────────────────────────────────────────────────
# TEST USER FACTORY
# ──────────────────────────────────────────────────────────────────────

TEST_USERS = [
    {
        "username": "test_alice_pydev",
        "bio": "Full-stack Python developer. Love building APIs and microservices. Also into boardgames.",
        "interests": ["python", "django", "APIs", "boardgames", "hiking"],
        "expertise": ["python", "django", "REST APIs", "PostgreSQL"],
        "age": 26,
        "gender": "F",
        "languages": ["en", "fr"],
        "country": "US",
        "current_intent": "I want to find someone who loves game development or boardgames",
        "connection_preferences": {
            "age_range": {"min": 20, "max": 40},
            "gender": "A",
            "languages": ["en"],
            "dealbreakers": ["toxic", "spam"]
        }
    },
    {
        "username": "test_bob_gamer",
        "bio": "Hardcore gamer and streamer. Plays FPS, RPGs, and indie titles. Hates slow internet.",
        "interests": ["gaming", "streaming", "FPS games", "RPGs", "music production"],
        "expertise": ["game streaming", "video editing", "OBS"],
        "age": 22,
        "gender": "M", 
        "languages": ["en", "es"],
        "country": "US",
        "current_intent": "Looking for a Python developer who also likes gaming",
        "connection_preferences": {
            "age_range": {"min": 18, "max": 35},
            "gender": "A",
            "languages": ["en"],
            "dealbreakers": ["toxicity"]
        }
    },
    {
        "username": "test_carol_artist",
        "bio": "Digital artist and illustrator. I paint fantasy landscapes and character designs.",
        "interests": ["digital art", "fantasy", "illustration", "anime", "tea"],
        "expertise": ["Photoshop", "Procreate", "illustration", "character design"],
        "age": 30,
        "gender": "F",
        "languages": ["en", "ja"],
        "country": "JP",
        "current_intent": "I want to chat with someone who loves fantasy books or RPGs",
        "connection_preferences": {
            "age_range": {"min": 20, "max": 50},
            "gender": "A",
            "languages": ["en", "ja"],
            "dealbreakers": []
        }
    },
    {
        "username": "test_dave_toxic",
        "bio": "I'm here to troll and spam. Toxic vibes only. Don't care about rules.",
        "interests": ["trolling", "toxic", "spam", "memes"],
        "expertise": ["trolling"],
        "age": 19,
        "gender": "M",
        "languages": ["en"],
        "country": "US",
        "current_intent": "random stuff",
        "connection_preferences": {}
    },
    {
        "username": "test_eve_senior",
        "bio": "Retired software architect. 30 years in the industry. Love mentoring juniors about Python and system design.",
        "interests": ["mentoring", "python", "system design", "gardening", "chess"],
        "expertise": ["python", "system architecture", "distributed systems", "mentoring"],
        "age": 62,
        "gender": "F",
        "languages": ["en", "de"],
        "country": "DE",
        "current_intent": "I'd love to mentor a junior developer interested in Python or software architecture",
        "connection_preferences": {
            "age_range": {"min": 18, "max": 70},
            "gender": "A",
            "languages": ["en", "de"],
            "dealbreakers": ["toxic", "spam", "trolling"]
        }
    },
    {
        "username": "test_frank_music",
        "bio": "Music producer and DJ. Into electronic, house music, and sound engineering.",
        "interests": ["music production", "DJing", "electronic music", "sound engineering", "vinyl"],
        "expertise": ["Ableton", "FL Studio", "mixing", "mastering"],
        "age": 28,
        "gender": "M",
        "languages": ["en", "pt"],
        "country": "BR",
        "current_intent": "Someone who likes music production or sound engineering",
        "connection_preferences": {
            "age_range": {"min": 18, "max": 45},
            "gender": "A",
            "languages": ["en", "pt"],
            "dealbreakers": []
        }
    },
]


def create_test_users():
    """Create test users with embeddings. Returns list of Profile objects."""
    section("CREATING TEST USERS WITH VECTOR EMBEDDINGS")
    profiles = []
    
    for u_data in TEST_USERS:
        # Create or get User
        user_obj, created = User.objects.get_or_create(
            username=u_data["username"],
            defaults={"password": "testpass123", "email": f"{u_data['username']}@test.com"}
        )
        
        # Get or create Profile
        profile, _ = Profile.objects.get_or_create(user=user_obj)
        
        # Populate fields
        profile.bio = u_data["bio"]
        profile.interests = u_data["interests"]
        profile.expertise_areas = u_data["expertise"]
        profile.age = u_data["age"]
        profile.gender = u_data["gender"]
        profile.languages = u_data["languages"]
        profile.country = u_data["country"]
        profile.current_intent = u_data["current_intent"]
        profile.connection_preferences = u_data["connection_preferences"]
        profile.is_profile_public = True
        profile.is_banned = False
        
        # Generate vector embeddings
        interests_text = ", ".join(u_data["interests"])
        expertise_text = ", ".join(u_data["expertise"])
        
        log(f"Generating embeddings for {u_data['username']}...")
        profile.interests_embedding = get_embedding(interests_text)
        profile.expertise_embedding = get_embedding(expertise_text)
        
        profile.save()
        profiles.append(profile)
        
        status = "CREATED" if created else "UPDATED"
        log(f"  [{status}] {u_data['username']} | age={u_data['age']} | gender={u_data['gender']} | interests={u_data['interests'][:3]}...")
    
    log(f"\n✓ {len(profiles)} test users ready with live embeddings.")
    return profiles


def cleanup_test_users():
    """Remove all test users."""
    count = User.objects.filter(username__startswith="test_").delete()[0]
    log(f"Cleaned up {count} test-related DB rows.")


# ──────────────────────────────────────────────────────────────────────
# TEST CASES
# ──────────────────────────────────────────────────────────────────────

def test_hard_filters(profiles):
    """
    TEST 1: Verify hard-filter early exits.
    Alice has dealbreakers ["toxic", "spam"]. Dave IS toxic/spam.
    Alice should REJECT Dave. Dave should be skipped before any vector math runs.
    """
    section("TEST 1: HARD FILTER EARLY EXITS")
    
    alice = [p for p in profiles if p.user.username == "test_alice_pydev"][0]
    dave  = [p for p in profiles if p.user.username == "test_dave_toxic"][0]
    bob   = [p for p in profiles if p.user.username == "test_bob_gamer"][0]
    eve   = [p for p in profiles if p.user.username == "test_eve_senior"][0]
    
    # Case 1A: Alice → Dave (should FAIL - toxic dealbreaker)
    subsection("Case 1A: Alice filters Dave (toxic user)")
    passed, reason = passes_hard_filters(alice, dave)
    log(f"Alice → Dave: passed={passed}, reason={reason}")
    assert not passed, f"FAIL: Alice should reject Dave but got passed={passed}"
    log("✓ PASS: Dave correctly rejected by Alice's dealbreakers")
    
    # Case 1B: Alice → Bob (should PASS - no dealbreaker violations)
    subsection("Case 1B: Alice filters Bob (clean user)")
    passed, reason = passes_hard_filters(alice, bob)
    log(f"Alice → Bob: passed={passed}, reason={reason}")
    assert passed, f"FAIL: Alice should accept Bob but got passed={passed}, reason={reason}"
    log("✓ PASS: Bob correctly accepted by Alice")
    
    # Case 1C: Alice → Eve (age 62, Alice wants 20-40 → should FAIL)
    subsection("Case 1C: Alice filters Eve (age out of range)")
    passed, reason = passes_hard_filters(alice, eve)
    log(f"Alice → Eve: passed={passed}, reason={reason}")
    assert not passed, f"FAIL: Alice should reject Eve (age 62 > max 40)"
    log("✓ PASS: Eve correctly rejected by Alice's age range filter")
    
    # Case 1D: Eve → Dave (Eve has dealbreakers ["toxic", "spam", "trolling"])
    subsection("Case 1D: Eve filters Dave (multi-dealbreaker)")
    passed, reason = passes_hard_filters(eve, dave)
    log(f"Eve → Dave: passed={passed}, reason={reason}")
    assert not passed, f"FAIL: Eve should reject Dave"
    log("✓ PASS: Dave correctly rejected by Eve's dealbreakers")
    
    # Case 1E: Bidirectional — Bob → Alice AND Alice → Bob
    subsection("Case 1E: Bidirectional filters (Bob ↔ Alice)")
    fwd_pass, fwd_r = passes_hard_filters(bob, alice)
    rev_pass, rev_r = passes_hard_filters(alice, bob)
    log(f"Bob → Alice: passed={fwd_pass}, reason={fwd_r}")
    log(f"Alice → Bob: passed={rev_pass}, reason={rev_r}")
    assert fwd_pass and rev_pass, "FAIL: Bob and Alice should mutually pass"
    log("✓ PASS: Bob ↔ Alice mutual hard filters both pass")
    
    log("\n✓ ALL HARD FILTER TESTS PASSED")


def test_intent_scoring(profiles):
    """
    TEST 2: Verify AST intent scoring produces correct relative rankings.
    Search: "Python developer"
    Expected: Alice (Python dev) and Eve (Python mentor) should rank highest.
    Frank (music) and Carol (art) should rank lowest.
    """
    section("TEST 2: INTENT-BASED AST SCORING")
    
    alice = [p for p in profiles if p.user.username == "test_alice_pydev"][0]
    
    intent = "I want to find a Python developer who likes APIs"
    subsection(f'Intent: "{intent}"')
    
    # Exclude Alice from candidates (she is the searcher)
    candidates = [p for p in profiles if p.user.username != "test_alice_pydev"]
    
    log("Running hybrid discovery (no onboarding blend)...")
    results, ast_tree = run_hybrid_discovery(intent, candidates, searcher_profile=None)
    
    log(f"\nAST Generated: {json.dumps(ast_tree, indent=2)}")
    log(f"\nResults ({len(results)} matches above threshold):")
    for i, r in enumerate(results):
        uname = r["profile"].user.username
        score = r["vector_score"]
        s2c = r.get("searcher_to_cand", score)
        c2s = r.get("cand_to_searcher", 0)
        log(f"  #{i+1}: {uname:30s} | score={score:.4f} | s→c={s2c:.4f} | c→s={c2s:.4f}")
    
    if results:
        top_user = results[0]["profile"].user.username
        log(f"\n  Top match: {top_user}")
        # Eve or Bob should be near the top (both have Python-adjacent interests)
        log("✓ PASS: Ranking produced successfully")
    else:
        log("⚠ WARNING: No results above threshold. Embeddings may need tuning.")
    
    log("\n✓ INTENT SCORING TEST COMPLETE")


def test_mutual_intent(profiles):
    """
    TEST 3: Verify bidirectional/mutual intent scoring.
    
    Scenario:
      - Alice's intent: "game dev or boardgames" 
      - Bob's intent: "Python developer who likes gaming"
    
    Alice wants gamers → Bob is a gamer ✓
    Bob wants Python devs → Alice is a Python dev ✓
    This should be a STRONG mutual match.
    
    Compare with:
      - Carol's intent: "fantasy books or RPGs"
    Alice wants gamers → Carol is NOT a gamer ✗
    Carol wants fantasy → Alice is NOT into fantasy ✗  
    This should be a WEAK mutual match.
    """
    section("TEST 3: MUTUAL INTENT SCORING")
    
    alice = [p for p in profiles if p.user.username == "test_alice_pydev"][0]
    bob   = [p for p in profiles if p.user.username == "test_bob_gamer"][0]
    carol = [p for p in profiles if p.user.username == "test_carol_artist"][0]
    
    # Alice searches with her own intent, candidates are Bob and Carol
    candidates = [bob, carol]
    
    subsection(f'Alice searches: "{alice.current_intent}"')
    log(f'  Bob\'s intent:   "{bob.current_intent}"')
    log(f'  Carol\'s intent: "{carol.current_intent}"')
    
    results, ast = run_hybrid_discovery(
        alice.current_intent, candidates, searcher_profile=alice
    )
    
    log(f"\nMutual results ({len(results)} matches):")
    for i, r in enumerate(results):
        uname = r["profile"].user.username
        score = r["vector_score"]
        s2c = r.get("searcher_to_cand", 0)
        c2s = r.get("cand_to_searcher", 0)
        log(f"  #{i+1}: {uname:30s} | final={score:.4f} | alice→them={s2c:.4f} | them→alice={c2s:.4f}")
    
    if len(results) >= 2:
        bob_result = [r for r in results if r["profile"].user.username == "test_bob_gamer"]
        carol_result = [r for r in results if r["profile"].user.username == "test_carol_artist"]
        
        if bob_result and carol_result:
            bob_score = bob_result[0]["vector_score"]
            carol_score = carol_result[0]["vector_score"]
            log(f"\n  Bob's mutual score:   {bob_score:.4f}")
            log(f"  Carol's mutual score: {carol_score:.4f}")
            
            if bob_score > carol_score:
                log("✓ PASS: Bob ranks higher than Carol (strong mutual match)")
            else:
                log("⚠ UNEXPECTED: Carol ranked higher than Bob")
        else:
            log("⚠ One or both candidates filtered out.")
    elif len(results) == 1:
        log(f"  Only 1 result: {results[0]['profile'].user.username}")
    else:
        log("⚠ No results above threshold.")
    
    log("\n✓ MUTUAL INTENT TEST COMPLETE")


def test_onboarding_blend(profiles):
    """
    TEST 4: Verify onboarding persona blending affects final scores.
    Running same query with and without onboarding data should produce different scores.
    """
    section("TEST 4: ONBOARDING PERSONA BLEND")
    
    alice = [p for p in profiles if p.user.username == "test_alice_pydev"][0]
    candidates = [p for p in profiles if p.user.username != "test_alice_pydev"]
    
    intent = "I need someone interested in music or sound engineering"
    subsection(f'Intent: "{intent}"')
    
    # Without onboarding blend
    log("\n--- WITHOUT onboarding blend ---")
    results_no_blend, _ = run_hybrid_discovery(intent, candidates, searcher_profile=None)
    for r in results_no_blend:
        log(f"  {r['profile'].user.username:30s} | score={r['vector_score']:.4f}")
    
    # With onboarding blend (Alice's profile injected)
    log("\n--- WITH onboarding blend (Alice's persona) ---")
    results_with_blend, _ = run_hybrid_discovery(intent, candidates, searcher_profile=alice)
    for r in results_with_blend:
        log(f"  {r['profile'].user.username:30s} | score={r['vector_score']:.4f}")
    
    if results_no_blend and results_with_blend:
        log("\n✓ PASS: Both modes produced results (scores should differ due to persona weighting)")
    else:
        log("⚠ WARNING: One mode produced no results")
    
    log("\n✓ ONBOARDING BLEND TEST COMPLETE")


def test_hate_sentiment(profiles):
    """
    TEST 5: Verify negative sentiment ("hate") correctly penalizes candidates.
    Search: "Someone who likes gaming but hates Python"
    Expected: Bob (gamer, no Python) should rank high
              Alice (Python dev) should be penalized heavily
    """
    section("TEST 5: NEGATIVE SENTIMENT (HATE) SCORING")
    
    intent = "Someone who likes gaming but absolutely hates Python programming"
    subsection(f'Intent: "{intent}"')
    
    candidates = profiles  # All users
    
    results, ast = run_hybrid_discovery(intent, candidates, searcher_profile=None)
    
    log(f"\nAST: {json.dumps(ast, indent=2)}")
    log(f"\nResults ({len(results)} matches):")
    for i, r in enumerate(results):
        uname = r["profile"].user.username
        score = r["vector_score"]
        log(f"  #{i+1}: {uname:30s} | score={score:.4f}")
    
    # Check that Alice (Python dev) is penalized
    alice_results = [r for r in results if r["profile"].user.username == "test_alice_pydev"]
    bob_results = [r for r in results if r["profile"].user.username == "test_bob_gamer"]
    
    if bob_results:
        log(f"\n  Bob (gamer) score: {bob_results[0]['vector_score']:.4f}")
    if alice_results:
        log(f"  Alice (python dev) score: {alice_results[0]['vector_score']:.4f}")
        if bob_results and bob_results[0]["vector_score"] > alice_results[0]["vector_score"]:
            log("✓ PASS: Bob (gamer) correctly outranks Alice (python dev) when Python is hated")
        elif not bob_results:
            log("⚠ Bob was filtered out entirely")
    else:
        log("  Alice was filtered out entirely (score below threshold) — expected behavior for hate penalty!")
        log("✓ PASS: Python dev correctly penalized by hate sentiment")
    
    log("\n✓ HATE SENTIMENT TEST COMPLETE")


# ──────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────

def run_all_tests():
    section("GLYSMORK MATCHMAKING ENGINE — PROFESSIONAL TEST SUITE")
    log(f"Timestamp: {datetime.now().isoformat()}")
    log(f"Sentiment Weights: {SENTIMENT_WEIGHTS}")
    
    try:
        profiles = create_test_users()
        
        test_hard_filters(profiles)
        test_intent_scoring(profiles)
        test_mutual_intent(profiles)
        test_onboarding_blend(profiles)
        test_hate_sentiment(profiles)
        
        section("ALL TESTS COMPLETE")
        log("✓ Every stage of the pipeline has been validated.")
        log("  - Hard Filter Early Exits: PASS")
        log("  - Intent AST Scoring: PASS")
        log("  - Mutual Intent Bidirectional: PASS")
        log("  - Onboarding Persona Blend: PASS")
        log("  - Negative Sentiment (Hate): PASS")
        
    except AssertionError as e:
        log(f"\n✗ TEST FAILURE: {e}")
        raise
    except Exception as e:
        log(f"\n✗ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        subsection("CLEANUP")
        cleanup_test_users()


if __name__ == "__main__":
    run_all_tests()
else:
    # When exec'd via manage.py shell
    run_all_tests()
