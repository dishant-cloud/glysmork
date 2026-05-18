from django.core.management.base import BaseCommand
import json
import sys

# Hack to allow importing from the FastAPI microservice which lives in the root directory
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../..'))

from onboarding_service.llm import extract_structured_data

class Command(BaseCommand):
    help = 'Tests the LLM extraction of an onboarding conversation'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("--- Onboarding Extraction Test ---"))
        self.stdout.write("Enter a mock conversation. Type 'END' on a new line to finish and extract.")
        
        history = []
        role = "assistant"
        
        # We start with the opening question
        history.append({
            "role": "assistant",
            "content": "What brings you here today? Tell us a little about what you're looking for — there's no right or wrong answer."
        })
        self.stdout.write(f"\nAI: {history[0]['content']}")
        
        while True:
            try:
                user_input = input("\nYou: ")
                if user_input.strip() == 'END':
                    break
                
                history.append({
                    "role": "user",
                    "content": user_input
                })
                
                # Mock a quick AI follow-up so we can chain a few back-and-forths
                ai_input = input("AI (type response or END): ")
                if ai_input.strip() == 'END':
                    break
                
                history.append({
                    "role": "assistant",
                    "content": ai_input
                })
                
            except EOFError:
                break
                
        self.stdout.write(self.style.WARNING("\nExtracting structured data via LLM... please wait..."))
        try:
            result = extract_structured_data(history)
            self.stdout.write(self.style.SUCCESS("\nExtraction Complete! Here is the JSON output:"))
            self.stdout.write(json.dumps(result, indent=2))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error extracting data: {e}"))
