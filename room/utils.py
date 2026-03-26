import json
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache
from room.models import Room, Message, CHAT_TYPE_FRIEND
from calls.models import CallLog
from django.contrib.auth.models import User
import uuid

def migrate_session_to_friend(user_a, user_b):
    """
    Atomically migrates ephemeral Redis session data to permanent PostgreSQL storage
    when two users become friends.
    """
    sorted_unames = sorted([user_a.username, user_b.username])
    room_name = f"direct_{sorted_unames[0]}_{sorted_unames[1]}"
    
    # Locate the active session for these two users.
    # Sessions are stored as `session:{session_id}:meta` with from_user_id and to_user_id.
    # Alternatively, the room is created as room_{min_id}_{max_id}_{uuid}.
    # We will search cache for matching meta, or we can just find the PostgreSQL Room that acts as a container.
    # From matchmaking.views.py, sessions are created as: f"room_{min_id}_{max_id}_{session_id}"
    
    min_id = min(user_a.id, user_b.id)
    max_id = max(user_a.id, user_b.id)
    
    # We look for Rooms matching this prefix that are 'active'
    session_rooms = Room.objects.filter(
        name__startswith=f"room_{min_id}_{max_id}_", 
        is_active=True
    )
    
    found_session_id = None
    for sr in session_rooms:
        parts = sr.name.split('_')
        if len(parts) >= 4:
            found_session_id = parts[3]
            break
            
    # If we couldn't find a matchmaking-generated room, try to check notification consumer sessions
    if not found_session_id:
        # A bit hacky, but NotificationConsumer creates `session:{session_id}:meta`
        pass
        # Cache doesn't support wildcards easily in Django without using redis-py directly.
        # However, we'll rely on the Room prefix matching logic first.
        # If it was initiated via ChatRequest, the frontend doesn't actually have a room yet sometimes,
        # but in this scope it's mostly Matchmaking rooms we need to migrate.
    
    with transaction.atomic():
        # 1. Create or ensure persistent Room in DB
        friend_room, created = Room.objects.get_or_create(
            name=room_name,
            defaults={'chat_type': CHAT_TYPE_FRIEND, 'is_active': True}
        )
        if created:
            friend_room.users.add(user_a, user_b)
        else:
            friend_room.is_active = True
            friend_room.save()
            
        # 2. Extract and migrate Redis data
        if found_session_id:
            msg_key = f"session:{found_session_id}:messages"
            call_key = f"session:{found_session_id}:calls"
            
            raw_msgs = cache.get(msg_key) or '[]'
            msgs_list = json.loads(raw_msgs)
            
            raw_calls = cache.get(call_key) or '[]'
            calls_list = json.loads(raw_calls)
            
            # Map usernames to users
            u_map = {user_a.username: user_a, user_b.username: user_b}
            
            msg_objects = []
            for msg in msgs_list:
                sender_un = msg.get('sender', msg.get('sender_id'))
                sender_user = u_map.get(sender_un)
                if sender_user and not msg.get('is_call_log'):
                    text = msg.get('text', '')
                    # We might need to ensure chronological order, but they are appended sequentially in Redis.
                    msg_obj = Message(
                        user=sender_user,
                        room=friend_room,
                        value=text,
                    )
                    # For precise timestamps, we would override `date` but auto_now_add is tricky.
                    # We can update it post-save if really needed.
                    msg_objects.append(msg_obj)
            
            if msg_objects:
                Message.objects.bulk_create(msg_objects)
                
            call_objects = []
            for call in calls_list:
                caller_un = call.get('caller_id')
                caller_user = u_map.get(caller_un)
                receiver_user = user_a if caller_user == user_b else user_b
                
                if caller_user:
                    call_id = call.get('call_id', uuid.uuid4())
                    call_objects.append(CallLog(
                        call_id=call_id,
                        caller=caller_user,
                        receiver=receiver_user,
                        mode='audio', # Assume audio if missing
                        status=call.get('status', 'ended'),
                        duration_seconds=call.get('duration', 0)
                    ))
            
            if call_objects:
                CallLog.objects.bulk_create(call_objects)
                
            # 3. Clean up Redis
            cache.delete(f"session:{found_session_id}:meta")
            cache.delete(msg_key)
            cache.delete(call_key)
            cache.delete(f"session:{found_session_id}:active")
            
            # Deactivate temp room container
            for sr in session_rooms:
                sr.is_active = False
                sr.save(update_fields=['is_active'])

    return friend_room
