from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from users.models import Profile, Report
from .serializers import ProfileSerializer, OnboardingQuizSerializer
from django.contrib.auth import authenticate, login
from django.utils import timezone
from datetime import timedelta
import os
import google.generativeai as genai
import json
from dotenv import load_dotenv

load_dotenv()

_gemini_key = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=_gemini_key)

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
                # Re-configure with fresh key at request time
                genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
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


class OnlineCountView(APIView):
    """Returns the count of currently online users."""
    permission_classes = [AllowAny]

    def get(self, request):
        profiles = Profile.objects.select_related('user').all()
        online = sum(1 for p in profiles if p.is_online())
        return Response({
            "online_count": online,
            "total_users": profiles.count(),
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


class AIOnboardingChatView(APIView):
    """
    AI-driven dynamic onboarding conversation.
    Instead of fixed questions, Gemini asks contextual follow-ups based on
    what the user actually says. After ~5-6 turns it signals completion
    and returns a structured profile summary for the analyze endpoint.
    """

    SYSTEM_PROMPT = """You are GLYSMORK's onboarding guide — curious, warm, and perceptive.
Your job is to get to know a new member through natural conversation.

Rules:
- Ask ONE short, specific question per turn. Never more than one.
- ALWAYS adapt your question to what the person just said. Mirror their energy.
  - If they say they're lonely/sad: gently explore that.
  - If they're excited/curious: explore what they want to discover.
  - If they mention a topic: dig into it naturally.
- Keep questions conversational, not clinical. Friendly but interesting.
- Don't repeat similar questions. Each turn should go deeper or in a new direction.
- After the user has answered 5 or more questions, respond with this JSON structure:

{
  "done": true,
  "final_question": "One last warm closing statement or micro-question",
  "profile_summary": {
    "primary_intent": "brief phrase describing why they joined",
    "mood_on_joining": "brief phrase e.g. lonely, curious, adventurous",
    "interests": ["list", "of", "topics"],
    "connection_style": "brief phrase e.g. prefers deep 1-on-1 chats",
    "one_word_vibe": "single word describing their energy"
  }
}

Before that point (step < 5), respond ONLY with:
{
  "done": false,
  "question": "Your next question here"
}
"""

    def _resolve_user(self, request):
        if request.user.is_authenticated:
            return request.user
        username = request.data.get('username')
        if username:
            from django.contrib.auth.models import User
            try:
                return User.objects.get(username=username)
            except User.DoesNotExist:
                return None
        return None

    # Keywords that require immediate crisis response — checked BEFORE any AI call
    CRISIS_KEYWORDS = [
        'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
        'hurt myself', 'self harm', 'self-harm', 'cutting myself',
        'no reason to live', "can't go on", 'cant go on', "don't want to live",
        'dont want to live', 'wish i was dead',
    ]

    CRISIS_RESPONSE = (
        "Hey — I hear you, and I'm really glad you told me this. "
        "What you're feeling right now is real, and you don't have to face it alone.\n\n"
        "Please reach out to a crisis line right now — free, confidential, 24/7:\n"
        "• iCall (India): 9152987821\n"
        "• Vandrevala Foundation: 1860-2662-345\n"
        "• International: https://www.iasp.info/resources/Crisis_Centres/\n\n"
        "GLYSMORK is also here. Would you like us to connect you with a real person to talk to right now?"
    )

    def post(self, request):
        user = self._resolve_user(request)
        if not user:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        history = request.data.get('history', [])
        message  = request.data.get('message', '').strip()
        step     = request.data.get('step', 0)

        # ===== CRISIS DETECTION — runs before ANY Gemini call =====
        if message:
            msg_lower = message.lower()
            if any(kw in msg_lower for kw in self.CRISIS_KEYWORDS):
                print(f"CRISIS DETECTED for user={user.username}: {repr(message)}")
                return Response({
                    "done": False,
                    "crisis": True,
                    "question": self.CRISIS_RESPONSE,
                }, status=status.HTTP_200_OK)
        # ==========================================================

        try:
            import ollama as ollama_client

            QUESTION_ANGLES = [
                "why they joined / what brought them here today",
                "their current emotional state or what's going on in their life",
                "the kind of people or connections they're hoping to find",
                "their interests, passions, or what they love talking about",
                "how they usually connect — deep 1-on-1s, group chats, light fun, etc.",
                "something personal — a goal, a hidden talent, or what makes them them",
            ]

            # Build full transcript
            transcript = ""
            for m in history:
                role_label = "GLYSMORK Guide" if m["role"] == "model" else "User"
                transcript += f"\n{role_label}: {m['text']}"
            if message:
                transcript += f"\nUser: {message}"

            already_covered = [QUESTION_ANGLES[i] for i in range(min(step, len(QUESTION_ANGLES)))]
            next_angle = QUESTION_ANGLES[min(step, len(QUESTION_ANGLES) - 1)]

            if not message:
                prompt = (
                    "A brand new user just created their GLYSMORK account. "
                    "Ask them ONE warm, open-ended question to find out why they joined today.\n\n"
                    "RESPOND ONLY with this JSON (no markdown, no extra text):\n"
                    '{"done": false, "question": "your question here"}'
                )
            elif step >= 5:
                prompt = (
                    f"You are wrapping up a GLYSMORK onboarding conversation. Full transcript:\n{transcript}\n\n"
                    "Based on everything shared, generate a warm closing statement and a structured profile summary.\n\n"
                    "RESPOND ONLY with this JSON (no markdown):\n"
                    '{\n  "done": true,\n  "final_question": "warm closing line here",\n'
                    '  "profile_summary": {\n'
                    '    "primary_intent": "brief phrase e.g. feeling lonely and seeking connection",\n'
                    '    "mood_on_joining": "brief phrase e.g. sad but open",\n'
                    '    "interests": ["topic1", "topic2"],\n'
                    '    "connection_style": "brief phrase e.g. prefers deep meaningful conversations",\n'
                    '    "one_word_vibe": "single word"\n'
                    '  }\n}'
                )
            else:
                already_str = ", ".join(already_covered) if already_covered else "nothing yet"
                prompt = (
                    f"You are conducting a warm onboarding conversation for GLYSMORK.\n"
                    f"Conversation so far:\n{transcript}\n\n"
                    f"Topics already explored: {already_str}\n"
                    f"Next topic to explore: {next_angle}\n\n"
                    f"Write ONE short, conversational question that:\n"
                    f"- Directly references what the user just said\n"
                    f"- Explores the next topic: {next_angle}\n"
                    f"- Feels like a natural follow-up, NOT generic\n"
                    f"- Is different from all previous questions\n\n"
                    f"RESPOND ONLY with this JSON (no markdown, no extra text):\n"
                    f'{{"done": false, "question": "your specific follow-up question here"}}'
                )

            # Call Llama 3 via Ollama
            ollama_response = ollama_client.chat(
                model='llama3:latest',
                messages=[{'role': 'user', 'content': prompt}],
                options={'temperature': 0.7, 'num_predict': 300},
            )
            raw = ollama_response['message']['content'].strip()

            # Clean markdown fences if model wraps in ```
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.rsplit("```", 1)[0].strip()

            # Extract first JSON object if model adds extra text
            import re
            json_match = re.search(r'\{[\s\S]*\}', raw)
            if json_match:
                raw = json_match.group(0)

            data = json.loads(raw)
            print(f"DEBUG OnboardingChat (llama3) step={step}: {json.dumps(data)[:200]}")
            return Response(data, status=status.HTTP_200_OK)


        except Exception as e:
            print(f"OnboardingChat Error: {e}")
            # Fallback questions if AI fails
            print(f"OnboardingChat Gemini ERROR (step={step}): {type(e).__name__}: {e}")

            # Smart fallback: adapt each question to the user's last message
            last_answer = message.strip() if message else ""
            # Truncate for embedding in question
            snippet = (last_answer[:60] + "...") if len(last_answer) > 60 else last_answer

            if step >= 5:
                return Response({
                    "done": True,
                    "final_question": "Thanks for being so open with me — this really helps us find the right people for you.",
                    "profile_summary": {
                        "primary_intent": last_answer[:80] if last_answer else "connecting with people",
                        "mood_on_joining": "open",
                        "interests": [],
                        "connection_style": "open to anything",
                        "one_word_vibe": "curious"
                    }
                })

            adaptive_questions = {
                0: "What made you decide to join GLYSMORK today?",
                1: (
                    f"You mentioned \"{snippet}\" — has that feeling been building for a while, "
                    f"or did something specific happen recently?"
                    if snippet else
                    "What's been going on in your life lately that brought you here?"
                ),
                2: (
                    f"Given what you shared, what kind of person do you think would actually make you feel less alone right now?"
                    if snippet else
                    "What kind of connection are you hoping to find here — someone to vent to, laugh with, or something else?"
                ),
                3: (
                    f"Outside of everything you just mentioned, what's something you genuinely love talking about — "
                    f"a topic that lights you up?"
                ),
                4: (
                    f"Do you prefer going deep in one long conversation, or lighter back-and-forth with a few people at once?"
                ),
            }
            q = adaptive_questions.get(step, adaptive_questions[4])
            return Response({"done": False, "question": q})


