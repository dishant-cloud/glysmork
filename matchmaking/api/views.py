from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from matchmaking.models import Loop, CallRequest, Friendship
from users.models import Profile
from room.models import Room
from .serializers import LoopSerializer, CallRequestSerializer
from django.db.models import Q
import os
import google.generativeai as genai
import json
import uuid

genai.configure(api_key="AIzaSyDLmm8qKlIUV1wTqRkh1hW3Pgu_Awf8JfU")

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
        
        if not intent:
            return Response(
                {"error": "Tell us who you want to talk to or what you want to discuss."},
                status=status.HTTP_400_BAD_REQUEST
            )

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
            
            # Create a persistent direct room
            sorted_usernames = sorted([user.username, match.username])
            room_name = f"direct_{sorted_usernames[0]}_{sorted_usernames[1]}"
            room, _ = Room.objects.get_or_create(name=room_name)
            room.users.add(user, match)
            room.is_active = True
            room.save()
            
            import time
            match.profile.current_intent = f'ROOM_READY:{room_name}:{time.time()}'
            match.profile.save(update_fields=['current_intent'])

            return Response({
                "status": "match_found", 
                "message": "Direct connection established.", 
                "matched_user": match.username,
                "room_name": room_name
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
        
        # --- PHASE 3: RANDOM MATCHING FILTERS ---
        match = None
        mode = 'chat' # Default mode
        
        # Only match with users who have been seen in the last 20 seconds
        active_loop = Loop.objects.filter(last_seen__gte=active_threshold).exclude(user=user)

        if intent.lower().startswith("random opposite gender"):
            my_gender = loop.gender
            target_gender = 'F' if my_gender == 'M' else 'M' if my_gender == 'F' else None
            
            # Extract requested mode (video or chat)
            if "video" in intent.lower():
                mode = 'video'
                # Ensure we only match someone who also asked for opposite gender video
                intent_filter = "random opposite gender video"
            else:
                mode = 'chat'
                intent_filter = "random opposite gender chat"
            
            if target_gender:
                # Find someone of the opposite gender who ALSO wants the same mode
                potential_match = active_loop.filter(
                    gender=target_gender,
                    user__profile__current_intent__iexact=intent_filter
                ).order_by('?').first() # Random order
                
                if potential_match:
                    match = potential_match.user
                    Loop.objects.filter(user__in=[user, match]).delete()
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
            candidates_with_reasons = self.attempt_discovery(user, intent)
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
            
            session_id = str(uuid.uuid4())[:6]
            room_name = f"room_{min(user.id, match.id)}_{max(user.id, match.id)}_{session_id}"
            room, _ = Room.objects.get_or_create(name=room_name)
            room.users.add(user, match)

            import time
            match.profile.current_intent = f'ROOM_READY:{room_name}:{time.time()}:{mode}'
            match.profile.save(update_fields=['current_intent'])

            return Response({
                "status": "match_found", 
                "message": "Connection established.", 
                "matched_user": match.username,
                "room_name": room_name,
                "mode": mode
            })
            
        return Response({
            "status": "waiting", 
            "message": "Scanning the network for the right person. You'll be notified when we find them.",
            "mode": intent.lower().split()[-1] if intent.lower().startswith("random opposite gender") else "chat"
        })

    def attempt_discovery(self, user, intent):
        """
        AI Search & Discovery Engine: Scans all public profiles to find the best 5 matches.
        """
        user_profile = user.profile
        
        # Expand pool to all public profiles, excluding the current user
        # We'll take a larger burst to filter down with AI
        candidates = Profile.objects.filter(
            is_profile_public=True,
            is_banned=False
        ).exclude(user=user).select_related('user').order_by('-last_seen')[:40]
        
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
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        
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


class SupportChatView(APIView):
    """
    Case 3: AI Emotional Support Conversation.
    Runs a multi-turn Gemini chat, responding empathetically to whatever the user says.
    After 3-4 exchanges the AI offers to connect them with a real person.
    """

    SYSTEM_PERSONA = (
        "You are a warm, compassionate AI companion inside the GLYSMORK app - a place where people connect. "
        "Your ONLY task right now is to make the person feel heard and less alone.\n\n"
        "Rules:\n"
        "- Keep replies SHORT (2-4 sentences max). Natural, human, never clinical.\n"
        "- NEVER give generic advice like 'see a therapist'. Just listen and ask gentle follow-up questions.\n"
        "- Reflect back what they say. Show you understood.\n"
        "- Use their own words when asking follow-up questions.\n"
        "- Never judge, never dismiss.\n"
        "- After the user has sent 3 or more messages and seems open to talking to a real person, "
        "end your reply with exactly this token on a new line: READY_TO_CONNECT\n"
        "  Only do this once when you feel the time is right.\n"
        "- If they say they want to connect to a real person, always include READY_TO_CONNECT at the end."
    )

    def _resolve_user(self, request):
        if request.user.is_authenticated:
            return request.user
        username = request.data.get('username')
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

        history = request.data.get('history', [])
        user_message = request.data.get('message', '').strip()

        try:
            ai_model = genai.GenerativeModel(
                model_name='gemini-2.5-flash',
                system_instruction=self.SYSTEM_PERSONA
            )

            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
            ]

            gemini_history = []
            for msg in history:
                gemini_history.append({
                    "role": msg["role"],
                    "parts": [msg["text"]]
                })

            chat = ai_model.start_chat(history=gemini_history)

            if not user_message:
                opener = "Please introduce yourself warmly and ask the person how they are feeling today. Keep it short and gentle."
                response = chat.send_message(opener, safety_settings=safety_settings)
            else:
                response = chat.send_message(user_message, safety_settings=safety_settings)

            reply_text = response.text.strip()

            ready_to_connect = "READY_TO_CONNECT" in reply_text
            if ready_to_connect:
                reply_text = reply_text.replace("READY_TO_CONNECT", "").strip()

            print(f"DEBUG SupportChat: user_msg={repr(user_message)}, ready={ready_to_connect}")

            return Response({
                "reply": reply_text,
                "ready_to_connect": ready_to_connect
            })

        except Exception as e:
            print(f"SupportChat AI Error: {e}")
            return Response({
                "reply": "I am here for you. Sometimes words are hard to find - take your time. What is on your mind?",
                "ready_to_connect": False
            })
