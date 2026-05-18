from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from matchmaking.models import Loop, CallRequest, Friendship, ChatNotification, MatchHistory, OfflineSearch
from users.models import Profile
from room.models import Room
from .serializers import LoopSerializer, CallRequestSerializer
from django.db.models import Q, Count
import os
import google.generativeai as genai
import json
import uuid
import time
from datetime import timedelta
from django.utils import timezone
import os

# API key relies on environment variable (from settings/dotenv)
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

import math

def get_commonality_reason(p1, p2):
    """Calculates commonalities between two profiles based on structured data."""
    interests1 = p1.interests if isinstance(p1.interests, list) else []
    interests2 = p2.interests if isinstance(p2.interests, list) else []
    expertise1 = p1.expertise_areas if isinstance(p1.expertise_areas, list) else []
    expertise2 = p2.expertise_areas if isinstance(p2.expertise_areas, list) else []
    topics1 = p1.conversation_topics if isinstance(p1.conversation_topics, list) else []
    topics2 = p2.conversation_topics if isinstance(p2.conversation_topics, list) else []

    common_interests = set(interests1) & set(interests2)
    common_expertise = set(expertise1) & set(expertise2)
    common_topics = set(topics1) & set(topics2)
    
    reasons = []
    if common_interests:
        reasons.append(f"shared interests in {', '.join(list(common_interests)[:3])}")
    if common_expertise:
        reasons.append(f"overlapping expertise in {', '.join(list(common_expertise)[:3])}")
    if common_topics:
        reasons.append(f"mutual curiosity about {', '.join(list(common_topics)[:3])}")
        
    if not reasons:
        if p1.country and p1.country == p2.country:
             return f"Neural connection established within {p1.country}. You both explore the same geographic sector."
        return "Neural synchronization complete. Your profiles suggest a high-bandwidth intellectual connection."
        
    return f"Neural Overlap detected: You both have {', and '.join(reasons)}."

def haversine_km(lat1, lon1, lat2, lon2):
    """Return the great-circle distance in km between two GPS points."""
    R = 6371  # Earth radius km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

class JoinMatchmakingView(APIView):
    """
    Universal Connection Engine.
    User describes WHO they want to talk to or WHAT they want to discuss.
    The AI analyzes all available profiles to find the perfect match.
    This is NOT dating — it's connecting minds based on intent, expertise, interest, and personality.
    """
    # permission_classes = [IsAuthenticated] # Temporarily disabled for Next.js testing

    def post(self, request):
        if request.user.is_authenticated:
            user = request.user
        else:
            # Try username from request body (cross-origin Next.js frontend)
            username_from_body = request.data.get('username')
            from django.contrib.auth.models import User as AuthUser
            if username_from_body:
                try:
                    user = AuthUser.objects.get(username=username_from_body)
                except AuthUser.DoesNotExist:
                    return Response({"error": f"User '{username_from_body}' not found."}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({"error": "Authentication required. Please provide a username or log in."}, status=status.HTTP_401_UNAUTHORIZED)
        intent = request.data.get('intent', '').strip()
        is_offline = request.data.get('is_offline', False)
        mode_pref = request.data.get('mode', 'chat') # chat or video
        gender_filter = request.data.get('gender_filter', 'A') # M, F, or A (Any)
        location_filter = request.data.get('location_filter', '').strip()
        country_filter = request.data.get('country_filter', [])
        language_filter = request.data.get('language_filter', [])

        # Ensure they are lists (handle legacy single-string inputs if any)
        if isinstance(country_filter, str) and country_filter:
            country_filter = [country_filter.strip().upper()]
        if isinstance(language_filter, str) and language_filter:
            language_filter = [language_filter.strip().lower()]
        
        # Default to empty lists if they are None or weird types
        if not isinstance(country_filter, list): country_filter = []
        if not isinstance(language_filter, list): language_filter = []
        
        distance_km = int(request.data.get('distance_km', 0) or 0)               # 0 = disabled
        use_onboarding_data = str(request.data.get('use_onboarding_data', 'false')).lower() in ['true', '1']
        
        if not intent and not is_offline:
            return Response(
                {"error": "Tell us who you want to talk to or what you want to discuss."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # --- QUOTA & SUBSCRIPTION CHECK ---
        today = timezone.localtime(timezone.now()).date()
        profile = user.profile
        if profile.last_quota_reset_date < today:
            profile.daily_ai_llm_searches = 0
            profile.daily_standard_searches = 0
            profile.daily_roulette_searches = 0
            profile.last_quota_reset_date = today
            profile.save(update_fields=['daily_ai_llm_searches', 'daily_standard_searches', 'daily_roulette_searches', 'last_quota_reset_date'])

        # Check Subscription
        is_subbed = profile.is_premium

        mode_type = "ROULETTE" if intent.lower().startswith("random opposite gender") else "STANDARD"
        
        is_polling = request.data.get('is_polling', False)
        
        # Enforce limits
        if not is_polling:
            if mode_type == "ROULETTE":
                if not is_subbed and profile.daily_roulette_searches >= 20:
                    return Response({"status": "quota_exceeded", "message": "Free Roulette limit reached."})
                profile.daily_roulette_searches += 1
            else:
                # For standard intents
                if use_onboarding_data:
                    # LLM heavy route
                    limit = 40 if is_subbed else 4
                    if profile.daily_ai_llm_searches >= limit:
                        return Response({"status": "quota_exceeded", "message": "Daily AI limit reached."})
                    profile.daily_ai_llm_searches += 1
                else:
                    # Basic vector/keyword match route
                    limit = 100 if is_subbed else 4
                    if profile.daily_standard_searches >= limit:
                        return Response({"status": "quota_exceeded", "message": "Daily standard search limit reached."})
                    profile.daily_standard_searches += 1
                
            profile.save(update_fields=['daily_ai_llm_searches', 'daily_standard_searches', 'daily_roulette_searches'])
        # ----------------------------------

        # --- NEW: OFFLINE SEARCH REGISTRATION ---
        if is_offline:
            OfflineSearch.objects.update_or_create(
                user=user,
                defaults={
                    'intent': intent,
                    'mode': mode_pref,
                    'gender_filter': gender_filter,
                    'location_filter': location_filter,
                    'country_filter': country_filter,
                    'language_filter': language_filter,
                    'distance_km_filter': distance_km,
                    'is_active': True,
                    'daily_refresh_timestamp': timezone.now()
                }
            )
            # Proceed to execute the search immediately.

        # --- NEW: DIRECT CONNECTION HANDLER (from Discovery) ---
        if intent.startswith('DIRECT_CONNECT:'):

            parts = intent.split(':')
            target_username = parts[1]
            mode = parts[2] if len(parts) >= 3 else 'chat'
            try:
                from django.contrib.auth.models import User as AuthUser
                match = AuthUser.objects.get(username=target_username)
            except AuthUser.DoesNotExist:
                return Response({"error": "Target node no longer available."}, status=status.HTTP_404_NOT_FOUND)
            
            # Create a persistent direct room with match reasoning
            match_reason = request.data.get('reason') or get_commonality_reason(user.profile, match.profile)
            sorted_usernames = sorted([user.username, match.username])
            room_name = f"direct_{sorted_usernames[0]}_{sorted_usernames[1]}"
            room, _ = Room.objects.get_or_create(name=room_name)
            room.users.add(user, match)
            room.is_active = True
            room.match_reason = match_reason
            room.save()
            
            import time
            match.profile.current_intent = f'ROOM_READY:{room_name}:{time.time()}:{mode}:{match_reason}'
            match.profile.save(update_fields=['current_intent'])

            return Response({
                "status": "match_found", 
                "message": "Direct connection established.", 
                "matched_user": match.username,
                "room_name": room_name,
                "match_reason": match_reason
            })

        # --- CHECK IF WE ALREADY HAVE A ROOM WAITING FOR THIS USER ---
        # This handles the case where User B matched User A while A was still polling.
        import time
        if user.profile.current_intent and user.profile.current_intent.startswith('ROOM_READY:'):
            parts = user.profile.current_intent.split(':', 4)  # ['ROOM_READY', room_name, timestamp, mode, match_reason]
            room_name_signal = parts[1] if len(parts) >= 2 else None
            timestamp_signal = float(parts[2]) if len(parts) >= 3 else 0
            mode_signal = parts[3] if len(parts) >= 4 else 'chat'
            # Expire after 10 minutes
            if room_name_signal and (time.time() - timestamp_signal) < 600:
                # Identify the partner from the room name
                partner_username = None
                if room_name_signal and room_name_signal.startswith('direct_'):
                    parts_room = room_name_signal.replace('direct_', '').split('_')
                    partner_username = parts_room[1] if parts_room[0] == user.username else parts_room[0]

                # Clear the signal
                user.profile.current_intent = ''
                user.profile.save(update_fields=['current_intent'])
                return Response({
                    "status": "match_found",
                    "message": "Your match was waiting for you.",
                    "room_name": room_name_signal,
                    "matched_user": partner_username,
                    "mode": mode_signal
                })
            else:
                # Stale signal — clear it and continue to fresh matchmaking
                user.profile.current_intent = ''
                user.profile.save(update_fields=['current_intent'])

        # Save the user's current intent
        user.profile.current_intent = intent
        user.profile.save(update_fields=['current_intent'])
        
        # Add or update user in Loop with their intent
        loop, created = Loop.objects.update_or_create(
            user=user,
            defaults={'gender': request.data.get('gender', user.profile.gender)}
        )

        # --- PRUNE STALE ENTRIES ---
        # If a user hasn't polled in 20 seconds, they are likely gone.
        active_threshold = timezone.now() - timedelta(seconds=20)
        Loop.objects.filter(last_seen__lt=active_threshold).delete()
        
        # --- PREVENT RE-MATCHES ---
        # Get IDs of users already matched in history
        history_ids = MatchHistory.objects.filter(Q(user1=user) | Q(user2=user)).values_list('user1_id', 'user2_id')
        excluded_ids = {user.id}
        for u1, u2 in history_ids:
            excluded_ids.add(u1)
            excluded_ids.add(u2)

        # Only match with users who have been seen in the last 20 seconds
        active_loop = Loop.objects.filter(last_seen__gte=active_threshold)
        
        # Prevent re-matches ONLY for discovery/AI search, NOT for random roulette
        if "random opposite gender" not in intent.lower():
            active_loop = active_loop.exclude(user_id__in=excluded_ids)
        else:
            # Still exclude self
            active_loop = active_loop.exclude(user_id=user.id)

        match = None
        mode = mode_pref
        custom_reason = None # Simplify reason for random matches

        if intent.lower().startswith("random opposite gender"):
            my_gender = loop.gender
            # Use manual gender filter if provided
            if gender_filter in ['M', 'F']:
                target_gender = gender_filter
            elif "roulette" in intent.lower() or intent.lower().startswith("random opposite gender"):
                # Default opposite gender for Roulette if no specific filter
                target_gender = 'F' if my_gender == 'M' else 'M' if my_gender == 'F' else None

            # Extract requested mode (video or chat)
            if "video" in intent.lower() or mode_pref == 'video':
                mode = 'video'
                intent_filter = "random opposite gender video"
            else:
                mode = 'chat'
                intent_filter = "random opposite gender chat"
            
            if target_gender:
                # Build filtered query: look for target_gender OR 'O' (wildcard)
                query = active_loop.filter(
                    Q(gender=target_gender) | Q(gender='O'),
                    user__profile__current_intent__icontains=mode
                )

                # --- LOCATION FILTERS ---
                # 1. Legacy plain-text location
                if location_filter:
                    query = query.filter(user__profile__location__icontains=location_filter)

                # 2. Country filter (multiple allowed)
                if country_filter:
                    query = query.filter(user__profile__country__in=country_filter)

                # 3. Language filter (match ANY of the selected languages)
                if language_filter:
                    lang_q = Q()
                    for lang in language_filter:
                        lang_q |= Q(user__profile__languages__contains=[lang])
                    query = query.filter(lang_q)

                # --- 4. GEOSPATIAL FILTER (Geohash Optimization) ---
                if distance_km > 0 and user.profile.latitude is not None and user.profile.longitude is not None:
                    from matchmaking.utils import geohash_encode
                    if not user.profile.geohash:
                        user.profile.geohash = geohash_encode(user.profile.latitude, user.profile.longitude)
                        user.profile.save(update_fields=['geohash'])
                    
                    # 1: 5000km, 2: 1250km, 3: 156km, 4: 39km, 5: 4.9km
                    precision = 1
                    if distance_km <= 5: precision = 5
                    elif distance_km <= 40: precision = 4
                    elif distance_km <= 160: precision = 3
                    elif distance_km <= 1250: precision = 2
                    
                    prefix = user.profile.geohash[:precision]
                    query = query.filter(user__profile__geohash__startswith=prefix)

                potential_match = query.order_by('?').first()

                # 5. Final Distance verification (precise Haversine)
                if potential_match and distance_km > 0:
                    my_lat = getattr(user.profile, 'latitude', None)
                    my_lon = getattr(user.profile, 'longitude', None)
                    if my_lat is not None and my_lon is not None:
                        cand_lat = getattr(potential_match.user.profile, 'latitude', None)
                        cand_lon = getattr(potential_match.user.profile, 'longitude', None)
                        if cand_lat is None or cand_lon is None:
                            potential_match = None  # Candidate has no location, skip
                        elif haversine_km(my_lat, my_lon, cand_lat, cand_lon) > distance_km:
                            potential_match = None  # Too far away (unlikely with geohash but good for edge cases)

                if potential_match:
                    match = potential_match.user
                    custom_reason = "Neural Link: Found in the Roulette matrix."
                    Loop.objects.filter(user__in=[user, match]).delete()
                    # Log to History
                    MatchHistory.objects.get_or_create(user1=min(user, match, key=lambda u: u.id), user2=max(user, match, key=lambda u: u.id))
            else:
                # If they are 'Other', just match them with anyone else wanting the exact same match type
                potential_match = active_loop.filter(
                    user__profile__current_intent__iexact=intent_filter
                ).order_by('?').first()
                if potential_match:
                    match = potential_match.user
                    custom_reason = "Neural Link: Found in the Roulette matrix."
                    Loop.objects.filter(user__in=[user, match]).delete()
                    
        elif intent.lower() == "persona match":
            # Pure random match with ANYONE else in the loop who also selected persona match
            potential_match = active_loop.filter(
                user__profile__current_intent__iexact="persona match"
            ).order_by('?').first()
            if potential_match:
                match = potential_match.user
                custom_reason = "Neural Link: Persona match established."
                Loop.objects.filter(user__in=[user, match]).delete()
        else:
            # --- THE AI DISCOVERY ENGINE ---
            # For personalized intent, we find a list of candidates instead of matching instantly.
            candidates_with_reasons = self.attempt_discovery(
                user, intent,
                country_filter=country_filter,
                language_filter=language_filter,
                distance_km=distance_km,
                use_onboarding_data=use_onboarding_data,
                is_offline=is_offline
            )
            if candidates_with_reasons == "NO_ONLINE_CANDIDATES":
                return Response({
                    "status": "no_online_users",
                    "message": "There are no potential candidates online right now."
                })
            elif candidates_with_reasons:
                user.profile.successful_searches += 1
                user.profile.save(update_fields=['successful_searches'])
                return Response({
                    "status": "discovery_results",
                    "results": candidates_with_reasons
                })
            else:
                return Response({
                    "status": "no_results",
                    "message": f"Zero neural nodes matched your intent: '{intent}'. Try broadening your search."
                })
        
        if match:
            # Random matching still creates a room immediately
            call_req = CallRequest.objects.create(
                sender=user,
                receiver=match,
                status='pending'
            )
            
            # Found a match! Calculate commonality
            reason = custom_reason if custom_reason else get_commonality_reason(user.profile, match.profile)
            session_id = uuid.uuid4().hex[:12]
            room_name = f"session_{session_id}"
            
            # Persist room to store match_reason
            room = Room.objects.create(name=room_name, chat_type='session', match_reason=reason)
            room.users.add(user, match)
            
            # --- TRUST SCORE: Total Session Tracking ---
            user.profile.total_sessions += 1
            user.profile.save(update_fields=['total_sessions'])
            match.profile.total_sessions += 1
            match.profile.save(update_fields=['total_sessions'])
            
            from users.trust import apply_trust_event
            apply_trust_event(user.id, 'session_started', 0, "Matched into a new session")
            apply_trust_event(match.id, 'session_started', 0, "Matched into a new session")
            # -------------------------------------------

            import time
            match.profile.current_intent = f'ROOM_READY:{room_name}:{time.time()}:{mode}:{reason}'
            match.profile.save(update_fields=['current_intent'])

            return Response({
                "status": "match_found", 
                "message": "Connection established.", 
                "matched_user": match.username,
                "room_name": room_name,
                "mode": mode,
                "match_reason": reason
            })
            
        return Response({
            "status": "waiting", 
            "message": "Scanning the network for the right person. You'll be notified when we find them.",
            "mode": intent.lower().split()[-1] if intent.lower().startswith("random opposite gender") else "chat"
        })

    def attempt_discovery(self, user, intent, country_filter=None, language_filter=None, distance_km=0, use_onboarding_data=False, is_offline=False):
        """
        AST Vector Search Engine: Parses intent into a strictly evaluated Boolean AST with numpy vector embeddings.
        """
        if country_filter is None: country_filter = []
        if language_filter is None: language_filter = []
        user_profile = user.profile

        # Start base queryset
        candidates_qs = Profile.objects.filter(
            is_profile_public=True,
            is_banned=False
        ).exclude(user=user).select_related('user')

        # --- PRE-FILTER: Exclude Existing Friends & History ---
        from django.db.models import Q
        from matchmaking.models import Friendship, MatchHistory
        friendships = Friendship.objects.filter(
            Q(from_user=user) | Q(to_user=user)
        )
        friend_ids = {f.from_user_id for f in friendships} | {f.to_user_id for f in friendships}
        
        history_ids = MatchHistory.objects.filter(Q(user1=user) | Q(user2=user)).values_list('user1_id', 'user2_id')
        for u1, u2 in history_ids:
            friend_ids.add(u1)
            friend_ids.add(u2)
            
        candidates_qs = candidates_qs.exclude(user_id__in=friend_ids)

        # --- PRE-FILTER: Online Status for Live Search ---
        if not is_offline:
            from django.utils import timezone
            from datetime import timedelta
            two_mins_ago = timezone.now() - timedelta(minutes=2)
            candidates_qs = candidates_qs.filter(last_seen__gte=two_mins_ago)
        else:
            candidates_qs = candidates_qs.filter(available_for_offline_search=True)

        # --- PRE-FILTER: Country (Multiple) ---
        if country_filter:
            candidates_qs = candidates_qs.filter(country__in=country_filter)

        # --- PRE-FILTER: Geohash (Scale Optimization) ---
        if distance_km > 0 and user_profile.latitude is not None and user_profile.longitude is not None:
            from matchmaking.utils import geohash_encode
            if not user_profile.geohash:
                user_profile.geohash = geohash_encode(user_profile.latitude, user_profile.longitude)
                user_profile.save(update_fields=['geohash'])
            
            # Determine prefix length based on distance
            # 1: 5000km, 2: 1250km, 3: 156km, 4: 39km, 5: 4.9km
            precision = 1
            if distance_km <= 5: precision = 5
            elif distance_km <= 40: precision = 4
            elif distance_km <= 160: precision = 3
            elif distance_km <= 1250: precision = 2
            
            prefix = user_profile.geohash[:precision]
            candidates_qs = candidates_qs.filter(geohash__startswith=prefix)


        # --- PRE-FILTER: Language (ANY of) ---
        if language_filter:
            lang_q = Q()
            for lang in language_filter:
                lang_q |= Q(languages__contains=[lang])
            candidates_qs = candidates_qs.filter(lang_q)

        candidates = list(candidates_qs.order_by('-last_seen')[:40])

        # --- POST-FILTER: Distance (Haversine, Python-side) ---
        if distance_km > 0 and user_profile.latitude is not None and user_profile.longitude is not None:
            def within_range(p):
                if p.latitude is None or p.longitude is None:
                    return False
                return haversine_km(user_profile.latitude, user_profile.longitude, p.latitude, p.longitude) <= distance_km
            candidates = [p for p in candidates if within_range(p)]

        if not candidates:
            print("DEBUG: Vector Search - No candidates found in database!")
            return "NO_ONLINE_CANDIDATES" if not is_offline else []
        
        # --- NEW ENGINE: AST + Vector Similarity + Persona Scoring ---
        from matchmaking.engine import run_hybrid_discovery
        try:
            print(f"DEBUG: Running engine for intent: {intent} (Onboarding Merge: {use_onboarding_data})")
            matches, ast_tree = run_hybrid_discovery(intent, candidates, searcher_profile=user_profile if use_onboarding_data else None)
            
            # Format results in descending score order
            results = []
            for match_data in matches[:5]:
                p = match_data["profile"]
                v_score = match_data["vector_score"]
                
                results.append({
                    "id": p.user.id,
                    "username": p.user.username,
                    "score": min(99, round(v_score * 100)),
                    "reason": f"Hybrid engine matched query with {round(v_score * 100)}% accuracy.",
                    "bio": p.bio,
                    "persona_image": p.persona_image_url,
                    "is_online": p.is_online(),
                    "match_tags": ["matched_via_ast"],
                    "expertise": p.expertise_areas[:3] if p.expertise_areas else [],
                    "interests": p.interests[:3] if p.interests else []
                })
            return results
        except Exception as e:
            print(f"Hybrid Search Engine Error: {e}")
            
            print("DEBUG: Falling back to standard database search due to AI failure.")
            fallback_results = []
            search_terms = intent.lower().split()
            
            for p in candidates:
                score = 0
                match_tags = []
                
                # Combine profile fields to search
                interests_str = ' '.join(p.interests) if p.interests else ''
                expertise_str = ' '.join(p.expertise_areas) if p.expertise_areas else ''
                bio_str = p.bio or ''
                text_to_search = f"{p.user.username} {bio_str} {interests_str} {expertise_str}".lower()
                
                # Check for keyword matches
                for term in search_terms:
                    if len(term) > 2 and term in text_to_search:
                        score += 30
                        if term not in match_tags:
                            match_tags.append(term)
                
                # Include users who match terms, or active users if search is broad
                if score > 0 or len(intent) < 3:
                    final_score = min(98, score + 45) # Baseline score
                    reason = f"Keyword match: {', '.join(match_tags)}" if match_tags else "Active network node."
                    
                    fallback_results.append({
                        "id": p.user.id,
                        "username": p.user.username,
                        "score": final_score,
                        "reason": reason,
                        "bio": p.bio,
                        "persona_image": p.persona_image_url,
                        "is_online": p.is_online(),
                        "match_tags": match_tags[:3],
                        "expertise": p.expertise_areas[:3] if p.expertise_areas else [],
                        "interests": p.interests[:3] if p.interests else []
                    })
            
            # Sort by score descending
            fallback_results.sort(key=lambda x: x['score'], reverse=True)
            
            # If no keyword matches found, just return the most recently active users as a last resort
            if not fallback_results:
                for p in list(candidates)[:5]:
                    fallback_results.append({
                        "id": p.user.id,
                        "username": p.user.username,
                        "score": 60,
                        "reason": "General network match (no exact keywords found).",
                        "bio": p.bio,
                        "persona_image": p.persona_image_url,
                        "is_online": p.is_online(),
                        "match_tags": ["discovery"],
                        "expertise": p.expertise_areas[:3] if p.expertise_areas else [],
                        "interests": p.interests[:3] if p.interests else []
                    })
                    
            return fallback_results[:5]

class FriendshipActionView(APIView):
    """
    Handles social actions: request, accept, decline, remove.
    """
    def _resolve_user(self, request):
        if request.user.is_authenticated:
            return request.user
        
        # Check body (POST) or query params (GET)
        username = request.data.get('username') or request.query_params.get('username')
        
        if username:
            from django.contrib.auth.models import User as AuthUser
            try:
                return AuthUser.objects.get(username=username)
            except AuthUser.DoesNotExist:
                return None
        return None

    def post(self, request):
        user = self._resolve_user(request)
        if not user:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
        
        action = request.data.get('action')
        target_username = request.data.get('target_username')
        
        if not target_username or not action:
            return Response({"error": "Action and target_username required"}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.contrib.auth.models import User as AuthUser
        try:
            target_user = AuthUser.objects.get(username=target_username)
        except AuthUser.DoesNotExist:
            return Response({"error": "Target user not found"}, status=status.HTTP_404_NOT_FOUND)

        if action == 'request':
            try:
                friendship, created = Friendship.objects.get_or_create(
                    from_user=user, 
                    to_user=target_user
                )
                
                # Trigger a notification for the recipient
                if created or friendship.status == 'pending':
                    from matchmaking.models import ChatNotification
                    # Check if there's already an unread notification from this sender to avoid spam
                    existing = ChatNotification.objects.filter(
                        sender=user, receiver=target_user, is_read=False
                    ).exists()
                    
                    if not existing:
                        ChatNotification.objects.create(
                            sender=user,
                            receiver=target_user,
                            message=f'{user.username} wants to connect with you',
                            room_name=f'direct_{user.username}_{target_user.username}'
                        )
                        
                        # Send real-time WebSocket signal to update UI instantly
                        try:
                            from channels.layers import get_channel_layer
                            from asgiref.sync import async_to_sync
                            layer = get_channel_layer()
                            if layer:
                                async_to_sync(layer.group_send)(
                                    f'user_{target_user.id}',
                                    {
                                        'type': 'friend_message_recv',
                                        'conversation_id': 'system',
                                        'sender': 'System',
                                        'text': 'refresh_notifications',
                                    }
                                )
                        except Exception as ws_err:
                            print(f"DEBUG: WebSocket signaling error on friend request: {ws_err}")

                return Response({"status": "requested", "created": created})
            except Exception as e:
                print(f"DEBUG: Friendship Request Error: {e}")
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        elif action == 'accept':
            try:
                # Update the incoming request
                Friendship.objects.filter(from_user=target_user, to_user=user).update(status='accepted')
                
                # Create or update reciprocal friendship
                Friendship.objects.update_or_create(
                    from_user=user, to_user=target_user,
                    defaults={'status': 'accepted'}
                )

                # TRIGGER TRUST EVENT (Friendships made)
                user.profile.friendships_made += 1
                user.profile.save(update_fields=['friendships_made'])
                target_user.profile.friendships_made += 1
                target_user.profile.save(update_fields=['friendships_made'])

                from users.trust import apply_trust_event
                apply_trust_event(user.id, 'friendship_accepted', 0, f"Started friendship with {target_user.username}")
                apply_trust_event(target_user.id, 'friendship_accepted', 0, f"Started friendship with {user.username}")

                return Response({"status": "accepted"})
            except Exception as e:
                print(f"DEBUG: Friendship Accept Error: {e}")
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        elif action == 'decline' or action == 'cancel':
            try:
                Friendship.objects.filter(
                    Q(from_user=user, to_user=target_user) | 
                    Q(from_user=target_user, to_user=user)
                ).delete()
                return Response({"status": "cleared"})
            except Exception as e:
                print(f"DEBUG: Friendship Decline Error: {e}")
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        elif action == 'remove':
            try:
                Friendship.objects.filter(
                    Q(from_user=user, to_user=target_user) | 
                    Q(from_user=target_user, to_user=user)
                ).delete()
                return Response({"status": "removed"})
            except Exception as e:
                print(f"DEBUG: Friendship Remove Error: {e}")
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        user = self._resolve_user(request)
        if not user:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
            
        friends = Friendship.objects.filter(from_user=user, status='accepted').select_related('to_user', 'to_user__profile')
        requests_received = Friendship.objects.filter(to_user=user, status='pending').select_related('from_user')
        requests_sent = Friendship.objects.filter(from_user=user, status='pending').select_related('to_user')
        
        friends_data = []
        for f in friends:
            profile = f.to_user.profile if hasattr(f.to_user, 'profile') else None
            from matchmaking.api.serializers import get_profile_image
            friends_data.append({
                "id": f.to_user.id,
                "username": f.to_user.username,
                "is_online": profile.is_online() if profile else False,
                "profile_image": get_profile_image(profile, f.to_user.username),
            })

        received_data = []
        for f in requests_received:
            profile = f.from_user.profile if hasattr(f.from_user, 'profile') else None
            received_data.append({"id": f.from_user.id, "username": f.from_user.username, "profile_image": get_profile_image(profile, f.from_user.username)})

        sent_data = [{"id": f.to_user.id, "username": f.to_user.username} for f in requests_sent]

        return Response({
            "friends": friends_data,
            "received": received_data,
            "sent": sent_data,
        })



class SendChatNotificationView(APIView):
    """Send a notification to a user that someone wants to chat."""
    permission_classes = []

    def post(self, request):
        from django.contrib.auth.models import User

        sender_username = request.data.get('sender')
        receiver_username = request.data.get('receiver')
        room_name = request.data.get('room_name', '')

        if not sender_username or not receiver_username:
            return Response({'error': 'sender and receiver required'}, status=status.HTTP_400_BAD_REQUEST)
        if sender_username == receiver_username:
            return Response({'error': 'cannot notify yourself'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sender = User.objects.get(username=sender_username)
            receiver = User.objects.get(username=receiver_username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # Don't spam — only create if no unread notif from same sender exists
        existing = ChatNotification.objects.filter(
            sender=sender, receiver=receiver, is_read=False
        ).first()
        if existing:
            return Response({'status': 'already_notified'})

        ChatNotification.objects.create(
            sender=sender,
            receiver=receiver,
            room_name=room_name,
            message=f'{sender_username} wants to chat with you!'
        )
        return Response({'status': 'sent'}, status=status.HTTP_201_CREATED)

class GetNotificationsView(APIView):
    """View to fetch unread chat notifications."""
    def get(self, request):
        username = request.query_params.get('username')
        if not username:
            return Response({"error": "Username required"}, status=status.HTTP_400_BAD_REQUEST)
        
        since = timezone.now() - timedelta(hours=24)
        notifs = ChatNotification.objects.filter(
            receiver__username=username,
            is_read=False,
            created_at__gte=since,
        ).order_by('-created_at')[:10]
        
        from .serializers import ChatNotificationSerializer
        serializer = ChatNotificationSerializer(notifs, many=True)
        return Response({"notifications": serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        """Mark notifications as read."""
        notif_ids = request.data.get('ids', [])
        if notif_ids:
            ChatNotification.objects.filter(id__in=notif_ids).update(is_read=True)
        return Response({"status": "success"}, status=status.HTTP_200_OK)

class TestNotificationView(APIView):

    """Diagnostic view to test real-time WebSocket signals."""
    def post(self, request):
        username = request.data.get('username')
        if not username:
            return Response({"error": "Username required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from django.contrib.auth.models import User
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        layer = get_channel_layer()
        if layer:
            async_to_sync(layer.group_send)(
                f'user_{user.id}',
                {
                    'type': 'friend_message_recv',
                    'conversation_id': 'test_room',
                    'sender': 'Glysmork System',
                    'text': 'This is a test notification!',
                }
            )
            return Response({"success": f"Test signal sent to user_{user.id}"})
        return Response({"error": "No channel layer"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UpdateLocationView(APIView):
    """Update user's latitude and longitude."""
    def post(self, request):
        username = request.data.get('username')
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        
        if not username or lat is None or lng is None:
            return Response({"error": "Username, latitude, and longitude required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            from django.contrib.auth.models import User
            user = User.objects.get(username=username)
            profile = user.profile
            profile.latitude = float(lat)
            profile.longitude = float(lng)
            
            # Generate Geohash for high-performance indexing
            from matchmaking.utils import geohash_encode
            profile.geohash = geohash_encode(profile.latitude, profile.longitude)
            
            profile.save()
            return Response({"status": "Location updated", "lat": lat, "lng": lng, "geohash": profile.geohash}, status=status.HTTP_200_OK)
        except (User.DoesNotExist, Profile.DoesNotExist):
            return Response({"error": f"User or Profile for {username} not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
