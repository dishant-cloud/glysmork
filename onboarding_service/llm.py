import json
import os
import sys

# Add parent dir so we can import groq_client from the Django root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from groq_client import groq_generate, groq_chat
from onboarding_service.config import DEFAULT_BUCKETS


def identify_buckets(opening_answer: str, existing_buckets: list) -> dict:
    """Part 3: Identify or create buckets based on the user's opening answer."""
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
    Return ONLY the JSON. No markdown, no preamble.
    """

    try:
        text = groq_generate(prompt)
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"Groq Error (identify_buckets): {e}. Using mock fallback.")
        return {
            "matched_buckets": ["COMPANIONSHIP"],
            "new_buckets": []
        }


def get_chat_response(message: str, history: list, guidelines: list) -> str:
    """Part 4: The Onboarding Conversation (Multi-turn)."""
    system_prompt = """You are a warm, curious, non-judgmental conversationalist helping us understand this person so we can find them the perfect match.
    
    Rules:
    - Ask ONE question at a time. Feel like a conversation, not a form.
    - Adapt your questions entirely based on what the user says. Follow their energy.
    - Go deeper into topics they seem passionate or emotional about.
    - Focus on who they are as a person — their personality, values, passions, humor, vibe, and what kind of connection they're looking for.
    - Keep it natural and human. No checklists.
    
    After 5-6 meaningful exchanges, when you feel you have a good sense of who they are, output exactly this text and nothing else:
    CONVERSATION_COMPLETE"""

    messages = [{"role": "system", "content": system_prompt}]

    for entry in history:
        role = "user" if entry["role"] == "user" else "assistant"
        messages.append({"role": role, "content": entry["content"]})

    messages.append({"role": "user", "content": message or "Hello"})

    try:
        return groq_chat(messages)
    except Exception as e:
        import traceback
        print(f"Groq Error (get_chat_response): {e}")
        traceback.print_exc()
        if len(history) >= 5:
            return "CONVERSATION_COMPLETE"
        fallback_questions = [
            "What makes you curious about matching with someone new today?",
            "Do you prefer deep late-night talks or fun, lighthearted banter?",
            "What's one thing you're absolutely looking for in a connection?",
            "If you could describe your ideal night out, what would it be?",
            "What's something about you that surprises people?"
        ]
        return fallback_questions[len(history) % len(fallback_questions)]


def extract_structured_data(conversation_history: list) -> dict:
    """Part 5: Extract structured JSON from the full conversation."""
    history_text = ""
    for entry in conversation_history:
        history_text += f"{entry['role'].upper()}: {entry['content']}\n"

    prompt = f"""
    Convert the following conversation into a single structured JSON object representing the user's matching preferences.
    Only extract information the user actually mentioned. Do NOT invent or assume values.
    
    The JSON extraction must have FOUR parts:
    1. human_summary:
      - A warm, human-readable 2-3 paragraph bio representing everything they said.
      
    2. hard_filters:
      - intents (array of short phrases describing why they joined)
      - age (integer, only if mentioned or clearly implied)
      - age_range (min, max integers — only if mentioned)
      - gender_preference (MALE / FEMALE / NON_BINARY / NO_PREFERENCE — only if mentioned)
      - dealbreakers (array of SCREAMING_SNAKE_CASE strings — only if mentioned)
      
    3. who_i_am:
      - free form dictionary of attributes describing this person.
      - Keys/Values must be SCREAMING_SNAKE_CASE adjective form American English singular, NO intensity modifiers.
      - e.g. "personality": "CALM", "hobby": "GAMER"
      
    4. who_i_want:
      - array of requirement objects. EVERY SINGLE THING the user wants must be a requirement object.
      Requirement object fields:
      - attribute (string — the trait being evaluated)
      - value (SCREAMING_SNAKE_CASE string, boolean, number, or range object with min and max)
      - direction (WANT / AVOID)
      - importance (float 0.0 to 1.0)
      - tolerance (ABSOLUTE / HARD / SOFT / FLEXIBLE)
      - confidence (HIGH / MEDIUM / LOW)
      - raw (string — exact words)
      
    Value standardization rules: Shortest simplest common American English word. Adjective always. Singular always. No intensity modifiers. No abbreviations. One concept one word. Positive framing in who_i_am.
    
    Conversation History:
    {history_text}
    
    Return EXACTLY a JSON response matching the schema described. No markdown, no preamble.
    """

    try:
        text = groq_generate(prompt)
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"Groq Error (extract_structured_data): {e}. Using mock fallback.")
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
