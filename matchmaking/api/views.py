from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from matchmaking.models import Loop, CallRequest
from users.models import Profile
from room.models import Room
from .serializers import LoopSerializer, CallRequestSerializer
from django.db.models import Q
import os
import google.generativeai as genai
import json

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

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
            # Fallback to the first user for Next.js testing without JWT
            from django.contrib.auth.models import User
            user = User.objects.first()
            if not user:
                return Response({"error": "No users in database."}, status=status.HTTP_400_BAD_REQUEST)
        intent = request.data.get('intent', '').strip()
        
        if not intent:
            return Response(
                {"error": "Tell us who you want to talk to or what you want to discuss."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save the user's current intent
        user.profile.current_intent = intent
        user.profile.save(update_fields=['current_intent'])
        
        # Add or update user in Loop with their intent
        loop, created = Loop.objects.update_or_create(
            user=user,
            defaults={'gender': request.data.get('gender', user.profile.gender)}
        )
        
        # Attempt to find a match based on the freeform intent
        match = self.attempt_intent_match(user, intent)
        
        if match:
            call_req = CallRequest.objects.create(
                sender=user,
                receiver=match,
                status='pending'
            )
            
            # Create a shared room for them
            room_name = f"room_{min(user.id, match.id)}_{max(user.id, match.id)}"
            room, created = Room.objects.get_or_create(name=room_name)
            if created:
                room.users.add(user, match)
                
            return Response({
                "status": "match_found", 
                "message": "The system found exactly who you need.", 
                "matched_user": match.username,
                "request_id": call_req.id,
                "room_name": room_name
            })
            
        return Response({
            "status": "waiting", 
            "message": "Scanning the network for the right person. You'll be notified when we find them."
        })

    def attempt_intent_match(self, user, intent):
        """
        Uses AI to understand the user's intent and cross-reference it against all 
        available profiles in the pool — their expertise, interests, psychological profile,
        and conversation history — to find the EXACT right person.
        """
        user_profile = user.profile
        
        # Get all candidates in the pool (exclude self)
        candidates = Loop.objects.exclude(user=user).select_related('user__profile').order_by('timestamp')[:10]
        
        if not candidates:
            return None
        
        # Build candidate summaries for the AI
        candidate_summaries = []
        for c in candidates:
            cp = c.user.profile
            candidate_summaries.append({
                "username": c.user.username,
                "psychological_profile": cp.psychological_profile or {},
                "interests": cp.interests or [],
                "expertise_areas": cp.expertise_areas or [],
                "conversation_topics": cp.conversation_topics or [],
                "current_intent": cp.current_intent or "",
                "bio": cp.bio or "",
                "self_reported_traits": cp.self_reported_traits or {},
            })
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""
        You are the Connection Engine — an AI that understands human intent at a profound level.
        
        A user wants to connect with someone. Here is their request:
        INTENT: "{intent}"
        
        Here is the requesting user's profile:
        - Psychological Profile: {json.dumps(user_profile.psychological_profile or {})}
        - Interests: {json.dumps(user_profile.interests or [])}
        - Expertise: {json.dumps(user_profile.expertise_areas or [])}
        - Past Conversation Topics: {json.dumps(user_profile.conversation_topics or [])}
        - Bio: {user_profile.bio}
        
        Here are the available people in the pool:
        {json.dumps(candidate_summaries, indent=2)}
        
        Your job:
        1. Understand EXACTLY what the user is looking for — it could be:
           - A specific type of person (e.g., "someone who understands grief", "a startup founder", "someone who speaks Japanese")
           - A specific topic (e.g., "I want to discuss quantum computing", "I need advice about investing")
           - A vibe or energy (e.g., "someone chill to vent to", "an intellectual sparring partner")
           - Or anything else
        2. Cross-reference the intent against ALL candidate profiles — their expertise, interests, psychology, past conversations
        3. Pick the BEST match, or return null if no one fits
        
        Return ONLY a valid JSON object:
        {{
            "best_match_username": string or null,
            "match_score": integer (0-100),
            "reason": string (why this person is the right connection for this intent)
        }}
        """
        
        try:
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:-3]
                
            analysis = json.loads(response_text)
            
            best_match = analysis.get("best_match_username")
            score = analysis.get("match_score", 0)
            
            if best_match and score > 60:
                from django.contrib.auth.models import User
                try:
                    matched_user = User.objects.get(username=best_match)
                    # Remove both from loop
                    Loop.objects.filter(user__in=[user, matched_user]).delete()
                    return matched_user
                except User.DoesNotExist:
                    pass
                    
        except Exception as e:
            print(f"Connection Engine AI Error: {e}")
            
        return None
