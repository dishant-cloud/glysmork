import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
django.setup()

from users.models import Profile
from django.contrib.auth.models import User

def check_profiles():
    profiles = Profile.objects.all()
    print(f"Total Profiles: {profiles.count()}")
    for p in profiles:
        print(f"User: {p.user.username}")
        print(f"  Expertise: {p.expertise_areas}")
        print(f"  Interests: {p.interests}")
        print(f"  Expertise Embedding Length: {len(p.expertise_embedding) if p.expertise_embedding else 0}")
        print(f"  Interests Embedding Length: {len(p.interests_embedding) if p.interests_embedding else 0}")
        print("-" * 20)

if __name__ == "__main__":
    check_profiles()
