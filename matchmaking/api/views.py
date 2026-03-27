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

genai.configure(api_key="AIzaSyDLmm8qKlIUV1wTqRkh1hW3Pgu_Awf8JfU")

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
        
        if not intent and not is_offline:
            return Response(
                {"error": "Tell us who you want to talk to or what you want to discuss."},
                status=status.HTTP_400_BAD_REQUEST
            )

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
            return Response({
                "status": "offline_activated",
                "message": "Offline matching activated. Check back daily to keep searching."
            })

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
            parts = user.profile.current_intent.split(':', 3)  # ['ROOM_READY', room_name, timestamp, mode?]
            room_name_signal = parts[1] if len(parts) >= 2 else None
            timestamp_signal = float(parts[2]) if len(parts) >= 3 else 0
            mode_signal = parts[3] if len(parts) >= 4 else 'chat'
            # Expire after 10 minutes
            if room_name_signal and (time.time() - timestamp_signal) < 600:
                # Clear the signal
                user.profile.current_intent = ''
                user.profile.save(update_fields=['current_intent'])
                return Response({
                    "status": "match_found",
                    "message": "Your match was waiting for you.",
                    "room_name": room_name_signal,
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
        from datetime import timedelta
        from django.utils import timezone
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
        active_loop = Loop.objects.filter(last_seen__gte=active_threshold).exclude(user_id__in=excluded_ids)

        match = None  # Initialize to prevent UnboundLocalError

        if intent.lower().startswith("random opposite gender"):
            my_gender = loop.gender
            target_gender = 'F' if my_gender == 'M' else 'M' if my_gender == 'F' else None
            
            # Use manual gender filter if provided and not roulette ( Roulette is strict )
            if "roulette" not in intent.lower():
                if gender_filter != 'A':
                    target_gender = gender_filter

            # Extract requested mode (video or chat)
            if "video" in intent.lower() or mode_pref == 'video':
                mode = 'video'
                intent_filter = "random opposite gender video"
            else:
                mode = 'chat'
                intent_filter = "random opposite gender chat"
            
            if target_gender:
                # Build filtered query
                query = active_loop.filter(
                    gender=target_gender,
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

                potential_match = query.order_by('?').first()

                # 4. Distance filter (post-query, uses Haversine in Python)
                if potential_match and distance_km > 0:
                    my_lat = getattr(user.profile, 'latitude', None)
                    my_lon = getattr(user.profile, 'longitude', None)
                    if my_lat is not None and my_lon is not None:
                        cand_lat = getattr(potential_match.user.profile, 'latitude', None)
                        cand_lon = getattr(potential_match.user.profile, 'longitude', None)
                        if cand_lat is None or cand_lon is None:
                            potential_match = None  # Candidate has no location, skip
                        elif haversine_km(my_lat, my_lon, cand_lat, cand_lon) > distance_km:
                            potential_match = None  # Too far away

                if potential_match:
                    match = potential_match.user
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
                    Loop.objects.filter(user__in=[user, match]).delete()
                    
        elif intent.lower() == "persona match":
            # Pure random match with ANYONE else in the loop who also selected persona match
            potential_match = active_loop.filter(
                user__profile__current_intent__iexact="persona match"
            ).order_by('?').first()
            if potential_match:
                match = potential_match.user
                Loop.objects.filter(user__in=[user, match]).delete()
        else:
            # --- THE AI DISCOVERY ENGINE ---
            # For personalized intent, we find a list of candidates instead of matching instantly.
            candidates_with_reasons = self.attempt_discovery(
                user, intent,
                country_filter=country_filter,
                language_filter=language_filter,
                distance_km=distance_km
            )
            if candidates_with_reasons:
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
            reason = get_commonality_reason(user.profile, match.profile)
            session_id = uuid.uuid4().hex[:12]
            room_name = f"session_{session_id}"
            
            # Persist room to store match_reason
            room = Room.objects.create(name=room_name, chat_type='session', match_reason=reason)
            room.users.add(user, match)

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

    def attempt_discovery(self, user, intent, country_filter=None, language_filter=None, distance_km=0):
        """
        AI Search & Discovery Engine: Scans all public profiles to find the best 5 matches.
        Applies country, language, and distance pre-filters before handing off to AI.
        """
        if country_filter is None: country_filter = []
        if language_filter is None: language_filter = []
        user_profile = user.profile

        # Start base queryset
        candidates_qs = Profile.objects.filter(
            is_profile_public=True,
            is_banned=False
        ).exclude(user=user).select_related('user')

        # --- PRE-FILTER: Country (Multiple) ---
        if country_filter:
            candidates_qs = candidates_qs.filter(country__in=country_filter)

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
            print("DEBUG: Neural Search - No candidates found in database!")
            return []
        
        print(f"DEBUG: Neural Search - Found {len(candidates)} candidate profiles.")
        
        candidate_summaries = []
        for p in candidates:
            summary = {
                "id": p.user.id,
                "username": p.user.username,
                "interests": p.interests or [],
                "expertise": p.expertise_areas or [],
                "bio": p.bio or "No bio provided.",
                "is_online": p.is_online()
            }
            candidate_summaries.append(summary)
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Lower safety thresholds
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"}
        ]

        prompt = f"""
        You are the 'Neural Search Engine' for GLYSMORK.
        Find the best 5 matches for: "{intent}"
        
        CANDIDATES:
        {json.dumps(candidate_summaries, indent=2)}
        
        TASK:
        1. Identify the TOP 5 most relevant users.
        2. BE EXTREMELY LENIENT. If no one matches "{intent}" perfectly, pick anyone who seems interesting or active.
        3. ALWAYS return 5 items if the pool has at least 5 people.
        
        Return ONLY valid JSON:
        {{
            "matches": [
                {{
                    "username": "string",
                    "score": 0-100,
                    "reason": "Explain the match for '{intent}'",
                    "match_tags": ["list"]
                }}
            ]
        }}
        """
        try:
            print(f"DEBUG: Sending prompt for query: {intent}")
            response = model.generate_content(prompt, safety_settings=safety_settings)
            text = response.text.strip()
            print(f"DEBUG: Raw AI Response: {text}")

            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            if "{" in text:
                import re
                match = re.search(r'(\{.*\})', text, re.DOTALL)
                if match: text = match.group(1)

            data = json.loads(text)
            print(f"DEBUG: Parsed AI Data: {json.dumps(data, indent=2)}")
            
            results = []
            for match_data in data.get("matches", []):
                try:
                    p = Profile.objects.get(user__username=match_data['username'])
                    results.append({
                        "id": p.user.id,
                        "username": p.user.username,
                        "score": match_data['score'],
                        "reason": match_data['reason'],
                        "bio": p.bio,
                        "persona_image": p.persona_image_url,
                        "is_online": p.is_online(),
                        "match_tags": match_data.get('match_tags', []),
                        "expertise": p.expertise_areas[:3],
                        "interests": p.interests[:3]
                    })
                except Profile.DoesNotExist:
                    continue
            return results
        except Exception as e:
            print(f"Neural Search AI Error: {e}")
            if hasattr(e, 'response') and hasattr(e.response, 'candidates'):
                print(f"Blocked or Empty? {e.response.candidates}")
            
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
            friends_data.append({
                "id": f.to_user.id,
                "username": f.to_user.username,
                "is_online": f.to_user.profile.is_online() if hasattr(f.to_user, 'profile') else False
            })

        received_data = [{"id": f.from_user.id, "username": f.from_user.username} for f in requests_received]
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
    """Poll for unread chat notifications."""
    permission_classes = []

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta

        username = request.query_params.get('username')
        if not username:
            return Response({'error': 'username required'}, status=status.HTTP_400_BAD_REQUEST)

        # Only show notifications created in the last 24 hours — ignore stale records
        since = timezone.now() - timedelta(hours=24)
        notifs = ChatNotification.objects.filter(
            receiver__username=username,
            is_read=False,
            created_at__gte=since,
        ).order_by('-created_at')[:10]


        data = [{
            'id': n.id,
            'sender': n.sender.username,
            'message': n.message,
            'room_name': n.room_name,
            'created_at': n.created_at.isoformat(),
        } for n in notifs]
        return Response({'notifications': data})

    def post(self, request):
        """Mark notifications as read."""
        notif_ids = request.data.get('ids', [])
        if notif_ids:
            ChatNotification.objects.filter(id__in=notif_ids).update(is_read=True)
        return Response({'status': 'ok'})
