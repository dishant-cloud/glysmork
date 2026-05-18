import google.generativeai as genai
import json
import numpy as np
import os
from django.conf import settings
from dotenv import load_dotenv
from groq_client import groq_generate

load_dotenv()

# Attempt to configure from API key if needed, or rely on global config
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

# Centralized scoring weights for ML optimization later (A/B testing, regression)
SENTIMENT_WEIGHTS = {
    "love": 2.2,
    "like": 1.0,
    "neutral": 0.2,
    "hate": -3.0
}

# ---------------------------------------------------------------------------
# Hard Filter Priorities (checked BEFORE any vector math to save CPU cycles)
# ---------------------------------------------------------------------------
HARD_FILTER_FIELDS = ["age_range", "gender", "country", "languages"]

def passes_hard_filters(searcher_profile, candidate_profile):
    """
    Checks static dealbreakers stored in connection_preferences.
    Returns (True, None) if candidate passes, (False, reason_str) if disqualified.
    This runs BEFORE any embedding / AST evaluation to save compute.
    """
    prefs = getattr(searcher_profile, 'connection_preferences', None)
    if not prefs or not isinstance(prefs, dict):
        return True, None  # No hard filters set => everyone passes

    # --- Age Range ---
    age_range = prefs.get("age_range")
    if age_range and isinstance(age_range, dict):
        min_age = age_range.get("min", 0)
        max_age = age_range.get("max", 200)
        cand_age = getattr(candidate_profile, 'age', 18)
        if cand_age < min_age or cand_age > max_age:
            return False, f"age {cand_age} outside [{min_age}-{max_age}]"

    # --- Gender ---
    gender_pref = prefs.get("gender")
    if gender_pref and gender_pref != "A":  # A = Any
        cand_gender = getattr(candidate_profile, 'gender', 'O')
        if cand_gender != gender_pref:
            return False, f"gender mismatch (wants {gender_pref}, got {cand_gender})"

    # --- Country ---
    country_pref = prefs.get("countries")
    if country_pref and isinstance(country_pref, list) and len(country_pref) > 0:
        cand_country = str(getattr(candidate_profile, 'country', ''))
        if cand_country and cand_country not in country_pref:
            return False, f"country {cand_country} not in {country_pref}"

    # --- Languages ---
    lang_pref = prefs.get("languages")
    if lang_pref and isinstance(lang_pref, list) and len(lang_pref) > 0:
        cand_langs = getattr(candidate_profile, 'languages', []) or []
        if not any(l in cand_langs for l in lang_pref):
            return False, f"no language overlap"

    # --- Custom Dealbreakers (freeform list) ---
    dealbreakers = prefs.get("dealbreakers", [])
    if dealbreakers and isinstance(dealbreakers, list):
        cand_interests = [str(x).lower() for x in (getattr(candidate_profile, 'interests', []) or [])]
        cand_expertise = [str(x).lower() for x in (getattr(candidate_profile, 'expertise_areas', []) or [])]
        cand_bio = (getattr(candidate_profile, 'bio', '') or '').lower()
        cand_text = ' '.join(cand_interests + cand_expertise) + ' ' + cand_bio
        for db_item in dealbreakers:
            if str(db_item).lower() in cand_text:
                return False, f"dealbreaker '{db_item}' found in profile"

    return True, None


# ---------------------------------------------------------------------------
# Vector Math
# ---------------------------------------------------------------------------

def cosine_similarity(v1, v2):
    """Calculates cosine similarity between two 1D numpy arrays."""
    v1_norm = np.linalg.norm(v1)
    v2_norm = np.linalg.norm(v2)
    if v1_norm == 0 or v2_norm == 0:
        return 0.0
    return float(np.dot(v1, v2) / (v1_norm * v2_norm))

def get_embedding(text):
    """
    Calls Gemini API to get text-embedding-004 vector.
    """
    if not text:
        return []
    try:
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']
    except Exception as e:
        print(f"Embedding Generation Error: {e}")
        return []


# ---------------------------------------------------------------------------
# AST Parser (LLM-driven)
# ---------------------------------------------------------------------------

def parse_intent_to_ast(intent_string):
    """
    Uses Groq LLM to parse a natural language query into a Boolean AST.
    Supported node types: 'AND', 'OR', 'NOT', 'vector_concept', 'exact_match'.
    """
    prompt = f"""
    You are a Query Parser. Convert the following matchmaking intent into a recursive Boolean AST JSON.
    Intent: "{intent_string}"
    
    Output strictly JSON, adhering to this structure:
    {{
      "operator": "AND" | "OR" | "NOT" | "LEAF",
      
      "operands": [ {{...}}, {{...}} ],
      
      "operand": {{...}},
      
      "type": "vector_concept" | "exact_match",
      "field": "interests" | "expertise" | "any",
      "value": "string",
      "sentiment": "love" | "like" | "hate" | "neutral"
    }}
    
    The user will speak in natural language. Parse their sentiment (e.g., 'would love' -> love, 'wouldnt mind' -> neutral, 'hates' -> hate).
    
    Example for "Someone who likes fantasy books but NOT software":
    {{
      "operator": "AND",
      "operands": [
        {{"operator": "LEAF", "type": "vector_concept", "field": "interests", "value": "fantasy books", "sentiment": "love"}},
        {{"operator": "LEAF", "type": "vector_concept", "field": "interests", "value": "software", "sentiment": "hate"}}
      ]
    }}

    For a simple query like "I want to talk about space", return:
    {{"operator": "LEAF", "type": "vector_concept", "field": "any", "value": "space", "sentiment": "like"}}

    Return ONLY the JSON. No markdown ticks, no preamble.
    """

    try:
        text = groq_generate(prompt)
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception as e:
        print(f"AST Parsing Error: {e}")
        print(f"Raw response: None")
        return {
            "operator": "LEAF",
            "type": "vector_concept",
            "field": "any",
            "value": intent_string
        }


# ---------------------------------------------------------------------------
# Recursive AST Evaluator
# ---------------------------------------------------------------------------

class MatchEvaluator:
    def __init__(self):
        # Cache embeddings for concepts during AST evaluation so we don't hit API repeatedly
        self.concept_embeddings = {}

    def _get_cached_embedding(self, config_value):
        if config_value not in self.concept_embeddings:
            self.concept_embeddings[config_value] = get_embedding(config_value)
        return self.concept_embeddings[config_value]

    def _evaluate_leaf(self, node, profile):
        """
        Evaluate a leaf node against a profile. Returns a float score.
        """
        node_type = node.get("type")
        value = node.get("value")
        field = node.get("field", "any")
        sentiment = node.get("sentiment", "like")
        
        # Look up empirical weight for AB Testing / ML models
        weight = SENTIMENT_WEIGHTS.get(sentiment, 1.0)
        
        base_score = 0.0

        if node_type == "exact_match":
            val_lower = str(value).lower()
            if field == "expertise":
                items = [str(x).lower() for x in (profile.expertise_areas or [])]
                base_score = 1.0 if val_lower in items else 0.0
            elif field == "interests":
                items = [str(x).lower() for x in (profile.interests or [])]
                base_score = 1.0 if val_lower in items else 0.0
            else:
                bio_lower = (profile.bio or "").lower()
                base_score = 1.0 if val_lower in bio_lower else 0.0

        elif node_type == "vector_concept":
            concept_vector = self._get_cached_embedding(value)
            
            best_score = 0.0
            
            if concept_vector:
                c_vec = np.array(concept_vector)
                
                def check_embeddings(emb_list):
                    nonlocal best_score
                    if not emb_list: return
                    if isinstance(emb_list, list) and len(emb_list) > 0 and isinstance(emb_list[0], list):
                        for u_vec_data in emb_list:
                            score = cosine_similarity(c_vec, np.array(u_vec_data))
                            if score > best_score:
                                best_score = score
                    elif isinstance(emb_list, list) and len(emb_list) > 0 and isinstance(emb_list[0], (int, float)):
                        score = cosine_similarity(c_vec, np.array(emb_list))
                        if score > best_score:
                            best_score = score
                
                if field in ("interests", "any"):
                    check_embeddings(getattr(profile, 'interests_embedding', None))
                if field in ("expertise", "any"):
                    check_embeddings(getattr(profile, 'expertise_embedding', None))
                
                if best_score == 0.0 and field != "any":
                    check_embeddings(getattr(profile, 'interests_embedding', None))
                    check_embeddings(getattr(profile, 'expertise_embedding', None))
                    if best_score > 0:
                        best_score *= 0.8
                        
            # --- ROBUST SUBSTRING FALLBACK ---
            # If embedding matching failed or scored low, fallback to literal keyword match.
            val_lower = str(value).lower()
            bio_lower = (profile.bio or "").lower()
            items = [str(x).lower() for x in (profile.interests or [])] + [str(x).lower() for x in (profile.expertise_areas or [])]
            
            # Massive boost if the literal term is in their interests or expertise
            if any(val_lower in item or item in val_lower for item in items):
                best_score = max(best_score, 1.0)
            # Strong boost if the term is in their bio
            elif val_lower in bio_lower:
                best_score = max(best_score, 0.8)

            base_score = max(0.0, float(best_score))

        return base_score * weight

    def evaluate_node(self, node, profile):
        """
        Recursively evaluate the AST for a specific profile.
        """
        if not node:
            return 0.0

        op = node.get("operator")
        
        if op == "LEAF":
            return self._evaluate_leaf(node, profile)
            
        elif op == "NOT":
            child_score = self.evaluate_node(node.get("operand", {}), profile)
            return 1.0 - child_score
            
        elif op == "AND":
            operands = node.get("operands", [])
            if not operands: return 0.0
            scores = [self.evaluate_node(child, profile) for child in operands]
            return min(scores) if scores else 0.0
            
        elif op == "OR":
            operands = node.get("operands", [])
            if not operands: return 0.0
            scores = [self.evaluate_node(child, profile) for child in operands]
            return max(scores) if scores else 0.0
            
        return 0.0


# ---------------------------------------------------------------------------
# Primary Entry Point: Hybrid Discovery with Mutual Intent + Hard Filters
# ---------------------------------------------------------------------------

def _extract_profile_vec(profile):
    """Safely extract a numpy vector from a profile's interests_embedding."""
    emb = getattr(profile, 'interests_embedding', None)
    if not emb:
        return None
    if isinstance(emb, list) and len(emb) > 0:
        if isinstance(emb[0], list):
            return np.array(emb[0])
        elif isinstance(emb[0], (int, float)):
            return np.array(emb)
    return None


def run_hybrid_discovery(intent_string, profiles_qs, searcher_profile=None):
    """
    Full Matching Pipeline:
      1. HARD FILTERS   – Skip candidates who violate static dealbreakers (zero CPU wasted).
      2. SEARCHER INTENT – Parse searcher's typed intent into AST, score each candidate.
      3. MUTUAL INTENT   – If candidate has a current_intent, parse it into AST and score searcher.
      4. ONBOARDING BLEND – If use_onboarding_data is on, blend baseline persona similarity.
      5. RANK & RETURN   – Sort by final composite score descending.
    
    Returns (sorted_results_list, searcher_ast_dict).
    """
    # Step 1: Parse the searcher's intent into an AST (one LLM call for the whole batch)
    searcher_ast = parse_intent_to_ast(intent_string)
    print("Parsed Searcher AST:", json.dumps(searcher_ast, indent=2))
    
    evaluator = MatchEvaluator()
    results = []

    # Pre-cache searcher vector for onboarding blend
    searcher_vec = _extract_profile_vec(searcher_profile) if searcher_profile else None

    # Cache candidate ASTs so we don't re-parse the same intent string
    _candidate_ast_cache = {}

    for candidate in profiles_qs:
        # ---------------------------------------------------------------
        # STAGE 1: HARD FILTER EARLY EXIT
        # ---------------------------------------------------------------
        if searcher_profile:
            passed, reason = passes_hard_filters(searcher_profile, candidate)
            if not passed:
                print(f"  HARD FILTER SKIP: {getattr(candidate, 'user', '?')} – {reason}")
                continue
            # Also check reverse: does the candidate's hard filters reject the searcher?
            passed_rev, reason_rev = passes_hard_filters(candidate, searcher_profile)
            if not passed_rev:
                print(f"  HARD FILTER SKIP (reverse): {getattr(candidate, 'user', '?')} – {reason_rev}")
                continue

        # ---------------------------------------------------------------
        # STAGE 2: SEARCHER INTENT vs CANDIDATE PROFILE
        # ---------------------------------------------------------------
        searcher_to_cand_score = evaluator.evaluate_node(searcher_ast, candidate)

        # ---------------------------------------------------------------
        # STAGE 3: MUTUAL INTENT (Candidate Intent vs Searcher Profile)
        # ---------------------------------------------------------------
        cand_to_searcher_score = 0.0
        mutual_weight = 1.0  # full weight on searcher direction by default

        cand_intent = getattr(candidate, 'current_intent', '') or ''
        # Only evaluate mutual intent if the candidate has a real search intent
        # (not a system string like ROOM_READY or a blank)
        if (searcher_profile 
            and cand_intent 
            and not cand_intent.startswith('ROOM_READY') 
            and not cand_intent.startswith('DIRECT_CONNECT')
            and len(cand_intent) > 3):
            
            # Parse from cache or fresh
            if cand_intent not in _candidate_ast_cache:
                _candidate_ast_cache[cand_intent] = parse_intent_to_ast(cand_intent)
            cand_ast = _candidate_ast_cache[cand_intent]
            
            cand_to_searcher_score = evaluator.evaluate_node(cand_ast, searcher_profile)
            # Both directions matter: average them (50/50 mutual)
            mutual_weight = 0.5

        if mutual_weight < 1.0:
            # Mutual mode: average both directions
            intent_score = (searcher_to_cand_score * mutual_weight) + (cand_to_searcher_score * mutual_weight)
        else:
            # One-directional: only searcher's intent matters
            intent_score = searcher_to_cand_score

        # ---------------------------------------------------------------
        # STAGE 4: ONBOARDING PERSONA BLEND (optional)
        # ---------------------------------------------------------------
        final_score = intent_score

        if searcher_vec is not None:
            cand_vec = _extract_profile_vec(candidate)
            if cand_vec is not None:
                onboarding_sim = cosine_similarity(searcher_vec, cand_vec)
                
                # Dynamic weighting: if the user typed a long, specific query, their explicit intent 
                # should dominate (preventing the "opposite match" penalty). If the query is generic, 
                # we rely more on baseline chemistry/similarity.
                if len(intent_string) > 30:
                    intent_weight = 0.90
                elif len(intent_string) > 15:
                    intent_weight = 0.75
                else:
                    intent_weight = 0.60
                    
                sim_weight = 1.0 - intent_weight
                final_score = (intent_score * intent_weight) + (max(0.0, onboarding_sim) * sim_weight)
        
        # Ensure the final score never exceeds 100% (1.0)
        final_score = min(1.0, final_score)

        # ---------------------------------------------------------------
        # STAGE 5: THRESHOLD & COLLECT
        # ---------------------------------------------------------------
        if final_score > 0.35:
            results.append({
                "profile": candidate,
                "vector_score": final_score,
                "searcher_to_cand": searcher_to_cand_score,
                "cand_to_searcher": cand_to_searcher_score,
            })

    # Sort descending by composite score
    results.sort(key=lambda x: x["vector_score"], reverse=True)
    return results, searcher_ast
