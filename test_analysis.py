import sys, os, json
sys.path.insert(0, os.path.abspath('.'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
import django
django.setup()
from groq_client import groq_generate

answers = {
    "q0": "idk, just checking out",
    "q1": "I like humility, and growth mindset are what I am looking for, that I want true love and and that I want to anything for her aned she should do anything for me."
}

prompt = f"""
You are a ruthless, highly intelligent psychological analyzer assessing a user for a profound matchmaking platform.
The user has submitted these answers to deep questions: {json.dumps(answers)}

Task: The Profound Profile & Persona Image.
Generate a deep psychological profile identifying their core traits, attachment style, communication style, and key strengths/growth areas.
Also extract a list of their interests and areas of expertise from their answers.
Finally, craft a highly stylistic text prompt that an AI Image Generator could use to create an abstract, neo-digital visual representation of this person's "soul". Keep the prompt under 50 words.

Respond ONLY in valid JSON format matching this schema:
{{
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
    print("RAW RESPONSE:")
    print(response_text)
    
    response_text = response_text.replace("```json", "").replace("```", "").strip()
    analysis = json.loads(response_text)
    print("\nSUCCESS!")
    print(json.dumps(analysis, indent=2))
except Exception as e:
    print(f"\nERROR: {e}")
