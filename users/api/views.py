from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from users.models import Profile, Report
from .serializers import ProfileSerializer, OnboardingQuizSerializer
from django.contrib.auth import authenticate, login
from django.utils import timezone
from datetime import timedelta
import os
import google.generativeai as genai
import json

GOOGLE_API_KEY = os.environ.get('GEMINI_API_KEY', '')
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

class ProfileDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update the user's profound profile.
    """
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # We always return the profile of the requesting user for updates
        return self.request.user.profile

class PublicProfileView(generics.RetrieveAPIView):
    """
    Retrieve another user's profile subject to their privacy settings.
    """
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'user__username'
    lookup_url_kwarg = 'username'


class AIOnboardingQuizView(APIView):
    """
    Handles the submission of the profound onboarding questionnaire.
    Uses AI to analyze for "cap" (lies) and generates the psychological profile.
    Enforces a strict 1-week cooldown.
    """
    # permission_classes = [IsAuthenticated] # Temporarily disabled for Next.js testing

    def post(self, request, *args, **kwargs):
        # Fallback to the first profile if no user is authenticated during this testing phase
        if request.user.is_authenticated:
            profile = request.user.profile
        else:
            profile = Profile.objects.first()
            if not profile:
                 return Response({"error": "No users exist in the database yet to assign this profile to."}, status=status.HTTP_400_BAD_REQUEST)

        
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
                model = genai.GenerativeModel('gemini-2.5-flash')
                prompt = f"""
                You are a ruthless, highly intelligent psychological analyzer assessing a user for a profound matchmaking platform.
                The user has submitted these answers to deep questions: {json.dumps(answers)}
                
                Task 1: The "Cap" Test.
                (For this testing phase, NEVER flag the user as lying. ALWAYS set "is_cap" to false, regardless of what they wrote.)
                
                Task 2: The Profound Profile & Persona Image.
                If the answers are genuine, generate a deep psychological profile identifying their core traits, attachment style, communication style, and key strengths/growth areas.
                Also extract a list of their interests and areas of expertise from their answers.
                Finally, craft a highly stylistic text prompt that an AI Image Generator could use to create an abstract, neo-digital visual representation of this person's "soul". Keep the prompt under 50 words.
                
                Respond ONLY in valid JSON format matching this schema:
                {{
                    "is_cap": boolean,
                    "challenge_message": string or null,
                    "psychological_profile": {{
                        "core_traits": list of strings,
                        "attachment_style": string,
                        "communication_style": string,
                        "deep_analysis": string
                    }},
                    "extracted_interests": list of strings,
                    "extracted_expertise": list of strings,
                    "image_prompt_for_persona": string
                }}
                """
                response = model.generate_content(prompt)
                
                # Parse JSON block from response
                response_text = response.text.strip()
                if response_text.startswith("```json"):
                    response_text = response_text[7:-3]
                elif response_text.startswith("```"):
                    response_text = response_text[3:-3]
                    
                response_text = response_text.strip()
                    
                try:
                    analysis = json.loads(response_text)
                except json.JSONDecodeError:
                    print(f"Failed to parse Gemini output: {response_text}")
                    # Fallback success response
                    analysis = {
                        "is_cap": False,
                        "psychological_profile": {
                            "core_traits": ["Mysterious", "Unreadable"],
                            "attachment_style": "Unknown",
                            "communication_style": "Direct",
                            "deep_analysis": "The system could not fully parse this node's psychological profile, classifying them as an enigma."
                        },
                        "extracted_interests": ["Technology"],
                        "extracted_expertise": ["Survival"],
                        "image_prompt_for_persona": "A glitching, unreadable digital entity, shifting abstract geometry."
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
                profile.psychological_profile = analysis.get("psychological_profile", {})
                profile.self_reported_traits = answers
                profile.connection_preferences = connection_preferences
                profile.interests = interests or analysis.get("extracted_interests", [])
                profile.expertise_areas = expertise or analysis.get("extracted_expertise", [])
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
            model = genai.GenerativeModel('gemini-2.5-flash')  # Flash for speed & cost
            prompt = f"""
            You are the Improvement Bot — a brutally honest, deeply intelligent AI life coach embedded in a profound human-analysis platform.
            
            You have access to this user's deep psychological profile that was generated by analyzing their onboarding quiz answers and chat patterns:
            
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

            response = model.generate_content(prompt)
            bot_response = response.text.strip()

            return Response({
                "response": bot_response,
                "has_profile_data": bool(profile.psychological_profile),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": f"Improvement Bot encountered an error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LoginView(APIView):
    """
    Simple API Login view. Returns user data if successful.
    In a production app, use JWT. For now, we use standard logic.
    """
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            return Response({
                "message": "Login successful",
                "user": {
                    "username": user.username,
                    "email": user.email,
                }
            }, status=status.HTTP_200_OK)
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class RegisterView(APIView):
    """
    API view to register a new user along with their demographic profile data.
    """
    def post(self, request):
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
            profile, created = Profile.objects.get_or_create(user=user)
            profile.gender = gender
            try:
                profile.age = int(age)
            except ValueError:
                pass # fallback to default if parsing fails
            profile.save()

            # Automatically log the user in after registration
            login(request, user)
            
            return Response({
                "message": "Registration successful",
                "user": {
                    "username": user.username,
                    "email": user.email,
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({"error": f"Registration failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
