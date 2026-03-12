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

genai.configure(api_key="AIzaSyCMXK_v5nP0TcWT0FMlPKUhOS5WbA51WrQ")

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
        
        # --- CHECK IF WE ALREADY HAVE A ROOM WAITING FOR THIS USER ---
        # This handles the case where User B matched User A while A was still polling.
        import time
        if user.profile.current_intent and user.profile.current_intent.startswith('ROOM_READY:'):
            parts = user.profile.current_intent.split(':', 2)  # ['ROOM_READY', room_name, timestamp?]
            room_name_signal = parts[1] if len(parts) >= 2 else None
            timestamp_signal = float(parts[2]) if len(parts) >= 3 else 0
            # Expire after 10 minutes
            if room_name_signal and (time.time() - timestamp_signal) < 600:
                # Clear the signal
                user.profile.current_intent = ''
                user.profile.save(update_fields=['current_intent'])
                return Response({
                    "status": "match_found",
                    "message": "Your match was waiting for you.",
                    "room_name": room_name_signal
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
        # Only match with users who have been seen in the last 20 seconds
        active_loop = Loop.objects.filter(last_seen__gte=active_threshold).exclude(user=user)

        if intent.lower() == "random opposite gender":
            my_gender = loop.gender
            target_gender = 'F' if my_gender == 'M' else 'M' if my_gender == 'F' else None
            
            if target_gender:
                # Find someone of the opposite gender who ALSO wants a random opposite gender match
                potential_match = active_loop.filter(
                    gender=target_gender,
                    user__profile__current_intent__iexact="random opposite gender"
                ).order_by('?').first() # Random order
                
                if potential_match:
                    match = potential_match.user
                    Loop.objects.filter(user__in=[user, match]).delete()
            else:
                # If they are 'Other', just match them with anyone else wanting a random match
                potential_match = active_loop.filter(
                    user__profile__current_intent__iexact="random opposite gender"
                ).order_by('?').first()
                if potential_match:
                    match = potential_match.user
                    Loop.objects.filter(user__in=[user, match]).delete()
        elif intent.lower() == "random connection":
            # Pure random match with ANYONE else in the loop who is active
            potential_match = active_loop.order_by('?').first()
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
                    "status": "waiting",
                    "message": "Scanning for people who match your intent..."
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
            match.profile.current_intent = f'ROOM_READY:{room_name}:{time.time()}'
            match.profile.save(update_fields=['current_intent'])

            return Response({
                "status": "match_found", 
                "message": "Connection established.", 
                "matched_user": match.username,
                "room_name": room_name
            })
            
        return Response({
            "status": "waiting", 
            "message": "Scanning the network for the right person. You'll be notified when we find them."
        })

    def attempt_discovery(self, user, intent):
        """
        AI Discovery Engine: Finds multiple matching profiles for a personalized intent.
        Returns a list of candidate user data with AI-generated reasons.
        """
        user_profile = user.profile
        # Only show people who were seen in the last 60 seconds (Online)
        from django.utils import timezone
        from datetime import timedelta
        online_threshold = timezone.now() - timedelta(seconds=60)
        
        candidates = Profile.objects.filter(
            last_seen__gte=online_threshold
        ).exclude(user=user).select_related('user')[:20]
        
        if not candidates:
            return []
        
        candidate_summaries = []
        for p in candidates:
            candidate_summaries.append({
                "username": p.user.username,
                "psychological_profile": p.psychological_profile or {},
                "interests": p.interests or [],
                "expertise_areas": p.expertise_areas or [],
                "current_intent": p.current_intent or "",
                "bio": p.bio or "",
            })
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"""
        You are the Connection Engine Discovery mode.
        User Intent: "{intent}"
        Requesting User Profile: {json.dumps({"interests": user_profile.interests, "expertise": user_profile.expertise_areas})}
        
        Candidates Pool:
        {json.dumps(candidate_summaries, indent=2)}
        
        Pick up to 5 best candidates from the pool that match the intent. 
        For each, provide a match_score (0-100) and a brief reason.
        
        Return ONLY valid JSON:
        {{
            "matches": [
                {{
                    "username": string,
                    "score": integer,
                    "reason": string
                }}
            ]
        }}
        """
        try:
            response = model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"): text = text[7:-3]
            data = json.loads(text)
            
            results = []
            for match_data in data.get("matches", []):
                try:
                    p = Profile.objects.get(user__username=match_data['username'])
                    results.append({
                        "username": p.user.username,
                        "score": match_data['score'],
                        "reason": match_data['reason'],
                        "bio": p.bio,
                        "persona_image": p.persona_image_url
                    })
                except Profile.DoesNotExist:
                    continue
            return results
        except Exception as e:
            print(f"Discovery Engine AI Error: {e}")
            return []

class FriendshipActionView(APIView):
    """
    Handles social actions: request, accept, decline, remove.
    """
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
            friendship, created = Friendship.objects.get_or_create(
                from_user=user, 
                to_user=target_user
            )
            return Response({"status": "requested", "created": created})
        
        elif action == 'accept':
            try:
                friendship = Friendship.objects.get(from_user=target_user, to_user=user)
                friendship.status = 'accepted'
                friendship.save()
                # Create reciprocal accepted friendship
                Friendship.objects.get_or_create(from_user=user, to_user=target_user, status='accepted')
                return Response({"status": "accepted"})
            except Friendship.DoesNotExist:
                return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
        
        elif action == 'decline' or action == 'cancel':
            Friendship.objects.filter(
                Q(from_user=user, to_user=target_user) | 
                Q(from_user=target_user, to_user=user)
            ).delete()
            return Response({"status": "cleared"})
            
        elif action == 'remove':
            Friendship.objects.filter(
                Q(from_user=user, to_user=target_user) | 
                Q(from_user=target_user, to_user=user)
            ).delete()
            return Response({"status": "removed"})

        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        user = self._resolve_user(request)
        if not user:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
            
        friends = Friendship.objects.filter(from_user=user, status='accepted')
        requests_received = Friendship.objects.filter(to_user=user, status='pending')
        requests_sent = Friendship.objects.filter(from_user=user, status='pending')
        
        return Response({
            "friends": [f.to_user.username for f in friends],
            "received": [r.from_user.username for r in requests_received],
            "sent": [s.to_user.username for s in requests_sent]
        })
