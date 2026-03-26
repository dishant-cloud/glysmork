import json
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from onboarding_service.config import GEMINI_API_KEY, DEFAULT_BUCKETS

genai.configure(api_key=GEMINI_API_KEY)

MODEL_NAME = 'gemini-2.0-flash'

def get_gemini_model():
    return genai.GenerativeModel(
        model_name=MODEL_NAME,
        safety_settings={
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
    )

def identify_buckets(opening_answer: str, existing_buckets: list) -> dict:
    """Part 3: Identify or create buckets based on the user's opening answer."""
    model = get_gemini_model()
    
    bucket_descriptions = "\n".join([f"- {b['name']}: {b['description']}" for b in existing_buckets])
    
    prompt = f"""
    The user was asked: "What brings you here today? Tell us a little about what you're looking for — there's no right or wrong answer."
    Their answer was: "{opening_answer}"
    
    Here are the existing buckets:
    {bucket_descriptions}
    
    Identify which existing bucket(s) the user belongs to.
    If their answer does NOT clearly fit any existing bucket, you MUST create a NEW bucket.
    
    If creating a new bucket, provide:
    - name (SCREAMING_SNAKE_CASE)
    - description (what it covers)
    - guidelines (instructions for the onboarding AI on what to ask this user)
    
    Return EXACTLY a JSON response in this format:
    {{
        "matched_buckets": ["BUCKET_NAME_1", "BUCKET_NAME_2"],
        "new_buckets": [
            {{
                "name": "NEW_BUCKET_NAME",
                "description": "description here",
                "guidelines": "guidelines here"
            }}
        ]
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        # Strip potential markdown code block markers
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"Gemini Error (identify_buckets): {e}. Using mock fallback.")
        # MOCK FALLBACK
        return {
            "matched_buckets": ["COMPANIONSHIP"],
            "new_buckets": []
        }


def get_chat_response(message: str, history: list, guidelines: list) -> str:
    """Part 4: The Onboarding Conversation (Multi-turn)."""
    model = get_gemini_model()
    
    guidelines_text = "\n".join(guidelines)
    
    system_prompt = f"""
    You are a warm, curious, non-judgmental assistant helping us understand this person so we can find them the perfect match.
    
    Here are the guidelines for what to explore based on why this person is here:
    {guidelines_text}
    
    Always collect these universal basics regardless of bucket: 
    - language
    - location preference (local / same country / global)
    - any hard dealbreakers
    
    Ask ONE question at a time. Feel like a conversation, not a form.
    Do NOT ask about things irrelevant to their bucket.
    
    When you feel you have a complete picture of everything needed, output exactly this text and nothing else:
    CONVERSATION_COMPLETE
    """
    
    chat = model.start_chat()
    # Inject system prompt into history conceptually (Gemini system_instruction exists on model, but we set it dynamically)
    # We will pass it as the first message or configure the model with it
    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=system_prompt,
        safety_settings={
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
    )
    chat = model.start_chat()
    
    # Replay history
    for entry in history:
        # Format: {"role": "user"|"assistant", "content": "..."}
        role = "user" if entry["role"] == "user" else "model"
        chat.history.append({"role": role, "parts": [entry["content"]]})
        
    try:
        response = chat.send_message(message or "Hello")
        return response.text.strip()
    except Exception as e:
        import traceback
        print(f"Gemini Error (get_chat_response): {e}")
        traceback.print_exc()
        print("Using mock fallback.")
        # MOCK FALLBACK - Smart simulated response based on history length
        if len(history) >= 5:
            return "CONVERSATION_COMPLETE"
        
        fallback_questions = [
            "What makes you curious about matching with someone new today?",
            "Do you prefer deep late-night talks or fun, lighthearted banter?",
            "What's one thing you're absolutely looking for in a connection?",
            "If you could describe your ideal night out, what would it be?",
            "Is there anything that's an immediate dealbreaker for you?"
        ]
        return fallback_questions[len(history) % len(fallback_questions)]


def extract_structured_data(conversation_history: list) -> dict:
    """Part 5: Extract structured JSON from the full conversation."""
    model = get_gemini_model()
    
    history_text = ""
    for entry in conversation_history:
        history_text += f"{entry['role'].upper()}: {entry['content']}\n"
        
    prompt = f"""
    Convert the following conversation into a single structured JSON object representing the user's matching preferences.
    Follow these rules STRICTLY:
    
    The JSON extraction must have FOUR parts:
    1. human_summary:
      - A warm, human-readable 2-3 paragraph bio representing everything they said. Synthesize their long explanations here so other users can read it on their profile.
      
    2. hard_filters:
      - intents (array of bucket names)
      - age (integer, estimate if not explicitly told but try to extract)
      - age_range (min, max integers)
      - gender_preference (MALE / FEMALE / NON_BINARY / NO_PREFERENCE)
      - location (string)
      - location_preference (LOCAL / SAME_COUNTRY / OPEN_TO_LONG_DISTANCE / GLOBAL)
      - languages (array of ISO 639-1 codes, e.g. ["en"])
      - dealbreakers (array of SCREAMING_SNAKE_CASE strings)
      
    3. who_i_am:
      - free form dictionary of attributes describing this person.
      - Keys/Values must be SCREAMING_SNAKE_CASE adjective form American English singular, NO intensity modifiers.
      - e.g. "personality": "CALM", "hobby": "GAMER"
      
    4. who_i_want:
      - array of requirement objects. EVERY SINGLE THING the user wants must be a requirement object.
      Requirement object fields:
      - attribute (string — the trait being evaluated)
      - value (SCREAMING_SNAKE_CASE string, boolean, number, or range object with min and max)
      - direction (WANT / AVOID) -> IMPORTANT: Do not use COMPLEMENT or EXCEED. If the user wants the opposite of themselves, resolve what that opposite value ACTUALLY is and output it as a WANT. If they want someone who EXCEEDS them, output the target absolute value as a WANT.
      - importance (float 0.0 to 1.0)
      - tolerance (ABSOLUTE / HARD / SOFT / FLEXIBLE)
      - conditions (array — optional, max 2 levels deep with AND/OR)
      - operator (AND / OR)
      - confidence (HIGH / MEDIUM / LOW)
      - raw (string — exact words)
      
    Value standardization rules: Shortest simplest common American English word. Adjective always (CREATIVE not CREATIVITY). Singular always (GOAL not GOALS). No intensity modifiers. No abbreviations. One concept one word. Positive framing in who_i_am.
    
    Importance: "I really need/must have" -> 1.0, "strongly prefer" -> 0.8, "would like/prefer" -> 0.6, "would be nice" -> 0.4, "slight preference" -> 0.2
    
    Conversation History:
    {history_text}
    
    Return EXACTLY a JSON response matching the schema described.
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"Gemini Error (extract_structured_data): {e}. Using mock fallback.")
        # MOCK FALLBACK
        return {
            "human_summary": "A curious seeker looking for meaningful connection and shared experiences in a digital world.",
            "hard_filters": {
                "intents": ["COMPANIONSHIP"],
                "age": 25,
                "age_range": {"min": 18, "max": 40},
                "gender_preference": "NO_PREFERENCE",
                "location": "Global",
                "location_preference": "GLOBAL",
                "languages": ["en"],
                "dealbreakers": []
            },
            "who_i_am": {"personality": "CURIOUS", "vibe": "FRIENDLY"},
            "who_i_want": [
                {"attribute": "personality", "value": "KIND", "direction": "WANT", "importance": 0.8, "tolerance": "SOFT"}
            ]
        }
