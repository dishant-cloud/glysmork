import os
import json
from celery import shared_task
from room.models import Room, Message
from users.models import Profile
from django.db import transaction
from groq_client import groq_generate

@shared_task
def generate_chat_analysis_task(room_name):
    """
    Background Celery task that analyzes a room's recent messages and updates user profiles.
    """
    try:
        room = Room.objects.get(name=room_name)
    except Room.DoesNotExist:
        return "Room not found"

    # Get recent messages (last 50 for token efficiency)
    messages = Message.objects.filter(
        room=room,
        deleted_for_everyone=False
    ).order_by('-date')[:50]

    if messages.count() < 5:
        return "Not enough messages to analyze yet."

    # Build conversation text
    conversation = []
    for msg in reversed(list(messages)):
        conversation.append(f"{msg.user.username}: {msg.value}")

    conversation_text = "\n".join(conversation)

    try:
        # Get all users in the room
        room_users = list(room.users.all())
        user_info = {}
        for u in room_users:
            user_info[u.username] = {
                "existing_interests": u.profile.interests or [],
                "existing_expertise": u.profile.expertise_areas or [],
                "existing_topics": u.profile.conversation_topics or [],
            }

        prompt = f"""
        You are a conversation analysis AI. Analyze this chat conversation and extract insights about each participant.
        
        PARTICIPANTS: {json.dumps(list(user_info.keys()))}
        EXISTING DATA: {json.dumps(user_info)}
        
        CONVERSATION:
        {conversation_text}
        
        For each participant, extract:
        1. NEW interests revealed (topics they seem genuinely interested in)
        2. NEW expertise revealed (things they demonstrate knowledge about)
        3. Conversation topics discussed
        4. Behavioral patterns (communication style, engagement level, emotional tone)
        
        Return ONLY valid JSON:
        {{
            "participants": {{
                "<username>": {{
                    "new_interests": ["list of new interests"],
                    "new_expertise": ["list of newly revealed expertise"],
                    "topics_discussed": ["list of topics in this conversation"],
                    "behavioral_notes": "brief note on how they communicate"
                }}
            }}
        }}
        """

        response_text = groq_generate(prompt)
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:-3]
        elif response_text.startswith("```"):
            response_text = response_text[3:-3]

        analysis = json.loads(response_text)
        participants_data = analysis.get("participants", {})

        updated_users = []
        with transaction.atomic():
            for u in room_users:
                if u.username in participants_data:
                    data = participants_data[u.username]
                    profile = u.profile

                    # Merge new interests (no duplicates)
                    existing_interests = set(profile.interests or [])
                    existing_interests.update(data.get("new_interests", []))
                    profile.interests = list(existing_interests)

                    # Merge expertise
                    existing_expertise = set(profile.expertise_areas or [])
                    existing_expertise.update(data.get("new_expertise", []))
                    profile.expertise_areas = list(existing_expertise)

                    # Append conversation topics (keep last 50)
                    topics = list(profile.conversation_topics or [])
                    topics.extend(data.get("topics_discussed", []))
                    profile.conversation_topics = topics[-50:]

                    profile.save(update_fields=['interests', 'expertise_areas', 'conversation_topics'])
                    updated_users.append(u.username)

        return f"Conversation analyzed. Profiles updated for: {', '.join(updated_users)}"

    except Exception as e:
        return f"Chat analysis failed: {str(e)}"

@shared_task
def cleanup_expired_sessions_task():
    """
    Background sweep task. Runs periodically (e.g. hourly) to clean up 
    orphaned or expired components of Redis sessions that weren't cleaned up correctly,
    AND deactivates old session rooms in PostgreSQL.
    """
    from django.core.cache import cache
    from room.models import Room
    from django.utils import timezone
    from datetime import timedelta
    import logging
    
    logger = logging.getLogger(__name__)
    count = 0
    
    # 1. Deactivate old SQL session rooms (over 24h old)
    cutoff = timezone.now() - timedelta(hours=24)
    old_rooms = Room.objects.filter(is_active=True, created_at__lt=cutoff, name__startswith='room_')
    
    with transaction.atomic():
        for r in old_rooms:
            # If it explicitly is a matchmaking generic room that never transitioned to a friend chat
            if r.chat_type == 'session' or (r.chat_type == 'friend' and r.messages.count() == 0):
                r.is_active = False
                r.save(update_fields=['is_active'])
                count += 1
                
    logger.info(f"Cleaned up {count} expired session rooms in PostgreSQL.")
    
    # 2. Redis native keys expire gracefully via their TTL of 24h (86400s) on creation/reset.
    # No explicit scan required unless we need exact garbage collection of non-expiring keys.
    # We will trust the robust TTL set in `_cache_set_list` (86400s = 24h).
    
    return f"Cleaned up {count} PostgreSQL rooms. Redis TTLs handle the rest."

