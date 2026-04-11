import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
django.setup()

from matchmaking.models import ChatNotification

print("--- UNREAD NOTIFICATIONS ---")
notifs = ChatNotification.objects.filter(is_read=False).order_by('-created_at')
for n in notifs:
    print(f"[{n.created_at}] From: {n.sender.username} -> To: {n.receiver.username} | Room: {n.room_name}")

if not notifs:
    print("None found.")
print("--------------------------")
