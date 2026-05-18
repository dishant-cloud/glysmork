import sys, os, json

# Setup Django environment
sys.path.insert(0, os.path.abspath('.'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
import django
django.setup()

from onboarding_service.llm import extract_structured_data

history = [
    {"role": "assistant", "content": "What brings you here today? Tell us a little about what you're looking for — there's no right or wrong answer."},
    {"role": "user", "content": "I'm a very introverted person, I like staying indoors, reading fantasy books and coding. But I want to meet someone who is the complete opposite. I want an extroverted, highly energetic party-goer who loves the outdoors. I'm looking for a serious relationship."},
    {"role": "assistant", "content": "That's an interesting dynamic! It sounds like you're looking for someone to pull you out of your comfort zone. Are there any specific dealbreakers you have?"},
    {"role": "user", "content": "Yeah, no smokers, and they must be between 22 and 30 years old. I don't really care about gender."},
]

print("Running LLM Extraction on the following mock conversation:\n")
for h in history:
    print(f"{h['role'].upper()}: {h['content']}")
print("\n" + "="*50 + "\nExtracting via Gemini LLM...\n" + "="*50)

result = extract_structured_data(history)
print(json.dumps(result, indent=2))
