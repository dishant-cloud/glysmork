import os
import django
import json
import numpy as np

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
django.setup()

from users.models import Profile
from matchmaking.engine import get_embedding

def backfill():
    profiles = Profile.objects.all()
    print(f"Starting backfill for {profiles.count()} profiles...")
    
    for p in profiles:
        print(f"Processing {p.user.username}...")
        updated = False
        
        # 1. Interests
        if p.interests and (not p.interests_embedding or len(p.interests_embedding) == 0):
            interests_text = ", ".join(p.interests)
            print(f"  Embedding interests: {interests_text[:50]}...")
            emb = get_embedding(interests_text)
            if emb:
                p.interests_embedding = emb
                updated = True
                
        # 2. Expertise
        if p.expertise_areas and (not p.expertise_embedding or len(p.expertise_embedding) == 0):
            expertise_text = ", ".join(p.expertise_areas)
            print(f"  Embedding expertise: {expertise_text[:50]}...")
            emb = get_embedding(expertise_text)
            if emb:
                p.expertise_embedding = emb
                updated = True
        
        # 3. Bio (Optional: could help broader search)
        # For now, let's stick to interests/expertise as per engine.py logic
        
        if updated:
            p.save(update_fields=['interests_embedding', 'expertise_embedding'])
            print(f"  [OK] Updated.")
        else:
            print(f"  [SKIP] Already embedded or no data.")

if __name__ == "__main__":
    backfill()
