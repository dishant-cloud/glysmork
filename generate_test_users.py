import os
import django
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
django.setup()

from django.contrib.auth.models import User
from users.models import Profile

first_names = ["Alex", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Cameron", "Quinn", "Avery", "Skyler", "Sam", "Jamie", "Dakota", "Reese", "Rowan", "Hayden", "Kendall", "Payton", "Emerson", "Finley"]
last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]

def generate_users(count=40):
    created = 0
    for i in range(count):
        fname = random.choice(first_names)
        lname = random.choice(last_names)
        username = f"{fname.lower()}{lname.lower()}{random.randint(10, 999)}"
        email = f"{username}@example.com"
        
        if not User.objects.filter(username=username).exists():
            u = User.objects.create_user(username=username, email=email, password='password123')
            
            # Profile is usually created via signals, so we update it
            profile = u.profile
            profile.age = random.randint(18, 45)
            profile.gender = random.choice(['M', 'F', 'O'])
            profile.location = random.choice(["New York", "London", "Tokyo", "Berlin", "Paris", "Sydney"])
            profile.country = random.choice(["US", "UK", "JP", "DE", "FR", "AU"])
            
            interests_pool = ["Music", "Gaming", "Travel", "Movies", "Reading", "Technology", "Art", "Sports", "Fitness", "Food"]
            profile.interests = random.sample(interests_pool, k=random.randint(2, 4))
            
            profile.bio = f"Hi, I'm {fname}! I love {', '.join(profile.interests)}."
            profile.trust_score = random.randint(30, 95)
            
            profile.save()
            created += 1
            print(f"Created user: {username}")
    
    print(f"\nSuccessfully created {created} test users!")
    print("All test users have the password: password123")

if __name__ == "__main__":
    generate_users(40)
