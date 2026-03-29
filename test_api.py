import requests
from django.contrib.auth.models import User
from room.models import Room

room = Room.objects.filter(name__startswith='session_').last()
if room:
    print(f"Room: {room.name}")
    print(f"Users in DB: {[u.username for u in room.users.all()]}")
    
    r = requests.get(f"http://127.0.0.1:8000/api/room/{room.name}/")
    print(f"API Response: {r.status_code} {r.text}")
else:
    print("No session room found")
