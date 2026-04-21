from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from users.models import Profile, Report
from .serializers import ProfileSerializer, OnboardingQuizSerializer
from django.contrib.auth import authenticate, login
from django.utils import timezone
from django.db.models import Count
from django.contrib.auth.models import User
from datetime import timedelta
import os
import json
from dotenv import load_dotenv
from rest_framework_simplejwt.tokens import RefreshToken
from groq_client import groq_generate
from matchmaking.engine import get_embedding
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import requests
import uuid

load_dotenv()

@api_view(['GET'])
@permission_classes([AllowAny])
def debug_cache(request):
    from django.core.cache import cache
    try:
        keys = list(cache._cache.keys())
        data = {str(k): str(cache._cache.get(k)) for k in keys}
        return Response({"cache": data})
    except Exception as e:
        return Response({"error": str(e)})

class ProfileDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update the user's profound profile.
    """
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # We always return the profile of the requesting user for updates
        # Auto-create profile if it doesn't exist (e.g., for terminal-created superusers)
        profile, created = Profile.objects.get_or_create(user=self.request.user)
        return profile

class PublicProfileView(generics.RetrieveUpdateAPIView):
    """
    Retrieve any user's profile by username — open to all (read).
    PATCH is allowed only for the owner (enforced in update).
    """
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [AllowAny]
    lookup_field = 'user__username'
    lookup_url_kwarg = 'username'

    def update(self, request, *args, **kwargs):
        # Only allow the owner to update their own profile
        instance = self.get_object()
        if not request.user.is_authenticated or request.user != instance.user:
            return Response({'error': 'Not authorized to edit this profile.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class AIOnboardingQuizView(APIView):
    """
    Handles the submission of the profound onboarding questionnaire.
    Uses AI to analyze for "cap" (lies) and generates the psychological profile.
    Enforces a strict 1-week cooldown.
    """
    # permission_classes = [IsAuthenticated] # Temporarily disabled for Next.js testing

    def post(self, request, *args, **kwargs):
        # Priority 1: Session-authenticated user
        if request.user.is_authenticated:
            profile = request.user.profile
        else:
            # Priority 2: username passed in request body (for cross-origin Next.js frontend)
            username_from_body = request.data.get('username')
            if username_from_body:
                from django.contrib.auth.models import User
                try:
                    user = User.objects.get(username=username_from_body)
                    profile = user.profile
                except User.DoesNotExist:
                    return Response({"error": f"User '{username_from_body}' not found."}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({"error": "Authentication required. Please provide a username or log in."}, status=status.HTTP_401_UNAUTHORIZED)

        
        # Check Cooldown (Temporarily disabled for active testing)
        # if profile.last_quiz_taken:
        #     time_since_last_quiz = timezone.now() - profile.last_quiz_taken
        #     if time_since_last_quiz < timedelta(days=7):
        #         return Response(
        #             {"error": f"You can only take the analysis quiz once a week. Try again in {(timedelta(days=7) - time_since_last_quiz).days} days."},
        #             status=status.HTTP_429_TOO_MANY_REQUESTS
        #         )

        serializer = OnboardingQuizSerializer(data=request.data)
        if serializer.is_valid():
            answers = serializer.validated_data.get('answers')
            connection_preferences = serializer.validated_data.get('connection_preferences', {})
            interests = serializer.validated_data.get('interests', [])
            expertise = serializer.validated_data.get('expertise', [])

            # --- AI LIE DETECTOR & ANALYSIS ("The Cap Test") ---
            try:
                prompt = f"""
                You are a ruthless, highly intelligent psychological analyzer assessing a user for a profound matchmaking platform.
                The user has submitted these answers to deep questions: {json.dumps(answers)}
                
                Task 1: The "Cap" Test.
                (For this testing phase, NEVER flag the user as lying. ALWAYS set "is_cap" to false, regardless of what they wrote.)
                
                Task 2: The Profound Profile & Persona Image.
                Generate a deep psychological profile identifying their core traits, attachment style, communication style, and key strengths/growth areas.
                Also extract a list of their interests and areas of expertise from their answers.
                Finally, craft a highly stylistic text prompt that an AI Image Generator could use to create an abstract, neo-digital visual representation of this person's "soul". Keep the prompt under 50 words.
                
                Respond ONLY in valid JSON format matching this schema:
                {{
                    "is_cap": false,
                    "challenge_message": null,
                    "psychological_profile": {{
                        "core_traits": ["string"],
                        "attachment_style": "string",
                        "communication_style": "string",
                        "deep_analysis": "string"
                    }},
                    "extracted_interests": ["string"],
                    "extracted_expertise": ["string"],
                    "image_prompt_for_persona": "string"
                }}
                Return ONLY the JSON. No markdown, no preamble.
                """
                try:
                    response_text = groq_generate(prompt)
                    response_text = response_text.replace("```json", "").replace("```", "").strip()
                    analysis = json.loads(response_text)
                except Exception as e:
                    print(f"Groq Analysis Error: {e}. Using mock fallback.")
                    analysis = {
                        "is_cap": False,
                        "psychological_profile": {
                            "core_traits": ["Analytical", "Observant", "Independent"],
                            "attachment_style": "Secure-Leaning",
                            "communication_style": "Direct and Logical",
                            "deep_analysis": "This individual displays a high degree of self-awareness and prioritizes authenticity in their connections."
                        },
                        "extracted_interests": ["Tech", "Philosophy", "Discovery"],
                        "extracted_expertise": ["Logic"],
                        "image_prompt_for_persona": "An intricate glass-like neural network, glowing with cyan pulses against a dark matte background, clean minimalist aesthetics."
                    }
                
                if analysis.get("is_cap"):
                    return Response(
                        {"cap_detected": True, "challenge": analysis.get("challenge_message")},
                        status=status.HTTP_406_NOT_ACCEPTABLE
                    )
                
                # Generate actual image URL via Pollinations
                import urllib.parse
                base_prompt = analysis.get("image_prompt_for_persona", "A mysterious abstract digital consciousness")
                # Add stylistic modifiers for that premium 'Unique' look
                style_modifiers = ", neo-digital, abstract glassmorphism, ethereal glowing aura, professional concept art, 8k resolution"
                encoded_prompt = urllib.parse.quote(base_prompt + style_modifiers)
                seed = timezone.now().microsecond # randomize output
                pollinations_url = f"https://pollinations.ai/p/{encoded_prompt}?width=512&height=512&seed={seed}&nologo=true"

                # If they passed, update Profile
                interests_list = interests or analysis.get("extracted_interests", [])
                expertise_list = expertise or analysis.get("extracted_expertise", [])
                
                profile.psychological_profile = analysis.get("psychological_profile", {})
                profile.self_reported_traits = answers
                profile.connection_preferences = connection_preferences
                profile.interests = interests_list
                profile.expertise_areas = expertise_list

                # Generate embeddings for neural search
                try:
                    if interests_list:
                        profile.interests_embedding = get_embedding(", ".join(interests_list))
                    if expertise_list:
                        profile.expertise_embedding = get_embedding(", ".join(expertise_list))
                except Exception as emb_e:
                    print(f"DEBUG: Embedding failed for user {profile.user.username}: {emb_e}")

                profile.persona_image_url = pollinations_url
                profile.last_quiz_taken = timezone.now()
                profile.save()

                return Response({
                    "message": "Profound analysis complete. Profile updated.", 
                    "profile": profile.psychological_profile,
                    "persona_image_url": profile.persona_image_url
                }, status=status.HTTP_200_OK)

            except Exception as e:
                # Fallback if API fails
                return Response({"error": f"AI Analysis failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ImprovementBotView(APIView):
    """
    AI-powered Improvement Bot. Analyzes the user's profound profile data 
    and provides deeply personalized advice to help them grow, improve, 
    or achieve a specific goal they describe.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        profile = request.user.profile
        user_message = request.data.get('message', '').strip()
        conversation_history = request.data.get('history', [])

        if not user_message:
            return Response(
                {"error": "Please provide a message or goal you want advice on."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Build rich context from the user's analyzed data
        profile_context = {
            "psychological_profile": profile.psychological_profile or {},
            "self_reported_traits": profile.self_reported_traits or {},
            "connection_preferences": profile.connection_preferences or {},
            "interests": profile.interests or [],
            "expertise_areas": profile.expertise_areas or [],
            "age": profile.age,
            "bio": profile.bio,
        }

        # Format conversation history for multi-turn context
        history_text = ""
        for msg in conversation_history[-10:]:  # Last 10 messages for token efficiency
            role = msg.get("role", "user")
            content = msg.get("content", "")
            history_text += f"\n{role.upper()}: {content}"

        try:
            system_prompt = "You are the Improvement Bot — a brutally honest, deeply intelligent AI life coach embedded in a profound human-analysis platform."
            prompt = f"""
            You have access to this user's deep psychological profile:
            
            PSYCHOLOGICAL PROFILE: {json.dumps(profile_context['psychological_profile'])}
            SELF-REPORTED TRAITS: {json.dumps(profile_context['self_reported_traits'])}
            CONNECTION PREFERENCES: {json.dumps(profile_context['connection_preferences'])}
            INTERESTS: {json.dumps(profile_context['interests'])}
            EXPERTISE: {json.dumps(profile_context['expertise_areas'])}
            USER AGE: {profile_context['age']}
            USER BIO: {profile_context['bio']}
            
            CONVERSATION HISTORY:{history_text}
            
            USER'S CURRENT MESSAGE: {user_message}
            
            INSTRUCTIONS:
            - Use the psychological profile data to give DEEPLY PERSONALIZED advice. Reference their specific traits, attachment style, and patterns.
            - Be honest and direct. Don't sugarcoat. But be constructive — always provide actionable steps.
            - If the user asks about self-improvement, relationships, career, mental health, or any goal — tailor advice using the data you have about them.
            - If their profile is empty (they haven't taken the quiz yet), encourage them to complete the onboarding analysis first for better advice, but still help with general guidance.
            - Keep responses concise but impactful. Use short paragraphs.
            - End with 1-3 specific, actionable steps they can take TODAY.
            
            Respond naturally as a conversation partner, not as a JSON object.
            """

            try:
                bot_response = groq_generate(prompt, system=system_prompt)
            except Exception as e:
                print(f"Improvement Bot Groq Error: {e}. Using mock fallback.")
                bot_response = "I'm currently reflecting on your profile insights. A good first step for today would be to reach out to one person who shares your core interests."

            return Response({
                "response": bot_response,
                "has_profile_data": bool(profile.psychological_profile),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": f"Improvement Bot encountered an error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GoogleLoginView(APIView):
    """
    Verifies a Google ID token and returns JWT access/refresh tokens.
    If the user doesn't exist, a new account is created and marked as verified.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('id_token')
        if not token:
            return Response({"error": "Google ID token required"}, status=status.HTTP_400_BAD_REQUEST)

        client_id = os.environ.get('GOOGLE_CLIENT_ID')
        if not client_id:
             # Fallback for development if not set, but warn
             print("WARNING: GOOGLE_CLIENT_ID not set in environment.")

        try:
            # Verify the ID token
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)

            # ID token is valid. Get user details.
            email = idinfo['email']
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')
            google_id = idinfo['sub']

            # Find or create user
            user, created = User.objects.get_or_create(email=email, defaults={
                'username': email.split('@')[0] + "_" + str(uuid.uuid4())[:4], # unique username
                'first_name': first_name,
                'last_name': last_name
            })

            # Update profile verification
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.is_verified = True
            profile.auth_provider = 'google'
            profile.save()

            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "message": "Google login successful",
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": {
                    "username": user.username,
                    "email": user.email,
                    "is_verified": profile.is_verified,
                    "is_new_user": created
                }
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            # Invalid token
            return Response({"error": f"Invalid Google token: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FacebookLoginView(APIView):
    """
    Verifies a Facebook access token and returns JWT access/refresh tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        access_token = request.data.get('access_token')
        if not access_token:
            return Response({"error": "Facebook access token required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Verify the token with Facebook Graph API
            fb_url = f"https://graph.facebook.com/me?fields=id,name,email,first_name,last_name&access_token={access_token}"
            fb_response = requests.get(fb_url)
            fb_data = fb_response.json()

            if 'error' in fb_data:
                return Response({"error": f"Invalid Facebook token: {fb_data['error'].get('message')}"}, status=status.HTTP_401_UNAUTHORIZED)

            email = fb_data.get('email')
            # Facebook allows accounts without emails (phone numbers). We need an email for our User model.
            if not email:
                 # Fallback to id-based email if not provided
                 email = f"{fb_data['id']}@facebook.com"

            first_name = fb_data.get('first_name', '')
            last_name = fb_data.get('last_name', '')

            # Find or create user
            user, created = User.objects.get_or_create(email=email, defaults={
                'username': email.split('@')[0] + "_fb_" + str(uuid.uuid4())[:4],
                'first_name': first_name,
                'last_name': last_name
            })

            # Update profile verification
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.is_verified = True
            profile.auth_provider = 'facebook'
            profile.save()

            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "message": "Facebook login successful",
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": {
                    "username": user.username,
                    "email": user.email,
                    "is_verified": profile.is_verified,
                    "is_new_user": created
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        print("DEBUG: LoginView.post started")
        username = request.data.get('username')
        password = request.data.get('password')
        print(f"DEBUG: LoginView.post - authenticating {username}")
        user = authenticate(request, username=username, password=password)
        print(f"DEBUG: LoginView.post - user is {user}")
        
        if user is not None:
            login(request, user)
            print("DEBUG: LoginView.post - generating tokens")
            refresh = RefreshToken.for_user(user)
            print("DEBUG: LoginView.post - return success")
            return Response({
                "message": "Login successful",
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": {
                    "username": user.username,
                    "email": user.email,
                }
            }, status=status.HTTP_200_OK)
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class RegisterView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        print("DEBUG: RegisterView.post started")
        from django.contrib.auth.models import User
        
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        gender = request.data.get('gender', 'O')
        age = request.data.get('age', 18)

        if not username or not email or not password:
            return Response({"error": "Username, email, and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create the base user
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            
            # Update the profile (which is usually auto-created by a Django signal)
            print("DEBUG: RegisterView.post - update profile")
            profile, created = Profile.objects.get_or_create(user=user)
            profile.gender = gender
            try:
                profile.age = int(age)
            except ValueError:
                pass # fallback to default if parsing fails
            profile.save()

            # Automatically log the user in after registration
            print("DEBUG: RegisterView.post - login")
            login(request, user)
            
            print("DEBUG: RegisterView.post - generate tokens")
            refresh = RefreshToken.for_user(user)
            print("DEBUG: RegisterView.post - return success")
            return Response({
                "message": "Registration successful",
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": {
                    "username": user.username,
                    "email": user.email,
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({"error": f"Registration failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OnlineCountView(APIView):
    """Returns the count of currently online users."""
    permission_classes = [AllowAny]

    def get(self, request):
        from django.contrib.auth.models import User
        profiles = Profile.objects.select_related('user').all()
        online = sum(1 for p in profiles if p.is_online())
        return Response({
            "online_count": online,
            "total_users": User.objects.count(),
        })


class HeartbeatView(APIView):
    """Frontend pings this every 30s to keep last_seen fresh."""
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        if not username:
            return Response({'error': 'username required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            profile = Profile.objects.get(user__username=username)
            profile.last_seen = timezone.now()
            profile.save(update_fields=['last_seen'])
            return Response({'status': 'ok'})
        except Profile.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)



class AnalyticsView(APIView):
    """
    Returns site-wide analytics for the dashboard.
    """
    permission_classes = [AllowAny] # Allow all to see the hub metrics

    def get(self, request, *args, **kwargs):
        now = timezone.now()
        one_week_ago = now - timedelta(days=7)
        five_minutes_ago = now - timedelta(minutes=5)

        total_users = Profile.objects.count()
        active_users = Profile.objects.filter(last_seen__gte=five_minutes_ago).count()

        # Gender Distribution
        gender_data = Profile.objects.values('gender').annotate(count=Count('gender'))
        gender_map = {
            'M': 'Male',
            'F': 'Female',
            'O': 'Other'
        }
        gender_stats = {gender_map.get(item['gender'], 'Unknown'): item['count'] for item in gender_data}

        # Location (Country) Distribution - Top 5
        location_data = Profile.objects.exclude(country='').values('country').annotate(count=Count('country')).order_by('-count')[:5]
        location_stats = {str(item['country']): item['count'] for item in location_data}

        # Time-series: Joins over past 7 days
        growth_stats = []
        for i in range(7):
            date = (now - timedelta(days=i)).date()
            count = User.objects.filter(date_joined__date=date).count()
            growth_stats.append({
                "date": date.strftime("%Y-%m-%d"),
                "joins": count
            })
        growth_stats.reverse()

        # Interests & Expertise Aggregation
        import collections
        all_interests = Profile.objects.exclude(interests=None).values_list('interests', flat=True)
        interest_counts = collections.Counter()
        for interests_list in all_interests:
            if isinstance(interests_list, list):
                interest_counts.update(interests_list)
        top_interests = dict(interest_counts.most_common(10))

        all_expertise = Profile.objects.exclude(expertise_areas=None).values_list('expertise_areas', flat=True)
        expertise_counts = collections.Counter()
        for expertise_list in all_expertise:
            if isinstance(expertise_list, list):
                expertise_counts.update(expertise_list)
        top_expertise = dict(expertise_counts.most_common(10))

        return Response({
            "total_users": total_users,
            "active_users": active_users,
            "gender_distribution": gender_stats,
            "top_locations": location_stats,
            "growth_trends": growth_stats,
            "top_interests": top_interests,
            "top_expertise": top_expertise
        })


class ImageUploadView(APIView):
    """
    Endpoint to upload a real profile photo.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        profile = request.user.profile
        if 'image' not in request.FILES:
            return Response({"error": "No image provided."}, status=status.HTTP_400_BAD_REQUEST)
        
        image_file = request.FILES['image']
        profile.image = image_file
        profile.save()
        
        return Response({
            "message": "Profile photo updated successfully.",
            "image_url": profile.image.url
        }, status=status.HTTP_200_OK)


class TrustScoreView(APIView):
    """
    Returns only the user's trust score, tier, and badge visibility status.
    """
    permission_classes = [AllowAny]

    def get(self, request, username, *args, **kwargs):
        from django.contrib.auth.models import User
        try:
            user = User.objects.get(username=username)
            profile = getattr(user, 'profile', None)
            if not profile:
                return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)
            
            return Response({
                "trust_score": profile.trust_score,
                "trust_tier": profile.trust_tier,
                "badge_visible": profile.trust_score >= 80,
                "flagged": profile.flagged_for_review
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)


class ReportUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username, *args, **kwargs):
        from django.contrib.auth.models import User
        from users.models import Report
        try:
            target_user = User.objects.get(username=username)
            if target_user == request.user:
                return Response({"error": "Cannot report yourself."}, status=status.HTTP_400_BAD_REQUEST)
                
            reason = request.data.get('reason', 'No reason provided')
            Report.objects.create(reporter=request.user, reported_user=target_user, reason=reason)
            
            from users.trust import apply_trust_event
            apply_trust_event(target_user.id, 'reported', 0, f"Reported by {request.user.username} for {reason}")
            
            return Response({"message": f"User {username} has been reported."}, status=status.HTTP_201_CREATED)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)


class BlockUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username, *args, **kwargs):
        from django.contrib.auth.models import User
        from users.models import Block
        try:
            target_user = User.objects.get(username=username)
            if target_user == request.user:
                return Response({"error": "Cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)
                
            reason = request.data.get('reason', 'No reason provided')
            Block.objects.get_or_create(blocker=request.user, blocked_user=target_user, defaults={'reason': reason})
            
            from users.trust import apply_trust_event
            apply_trust_event(target_user.id, 'blocked', 0, f"Blocked by {request.user.username}")
            
            # Future: Delete ongoing sessions or friend requests related to this block if necessary.
            return Response({"message": f"User {username} has been blocked."}, status=status.HTTP_201_CREATED)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
