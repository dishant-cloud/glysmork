from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from room.models import Message, Room
from .serializers import MessageSerializer
from django.utils import timezone
from django.http import HttpResponse
import os
import google.generativeai as genai
import json

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "YOUR_STATIC_KEY_HERE_FOR_DEV"))


class MessageActionView(APIView):
    """
    Handle individual message actions: mark read, delete for me, delete for everyone.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id):
        try:
            message = Message.objects.get(id=message_id)
        except Message.DoesNotExist:
            return Response({"error": "Message not found"}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        
        # Security: User must be part of the room
        if request.user not in message.room.users.all():
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        if action == 'mark_read':
            if message.user != request.user and not message.is_read:
                message.is_read = True
                message.read_timestamp = timezone.now()
                message.save()
            return Response({"status": "read"})

        elif action == 'delete_for_me':
            if message.user == request.user:
                message.deleted_for_sender = True
                message.save()
            return Response({"status": "deleted_for_me"})

        elif action == 'delete_for_everyone':
            if message.user == request.user:
                message.deleted_for_everyone = True
                message.deleted_timestamp = timezone.now()
                message.save()
            return Response({"status": "deleted_for_everyone"})

        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

class TranscriptDownloadView(APIView):
    """
    Generates a downloadable text transcript of a chat room.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, room_name):
        try:
            room = Room.objects.get(name=room_name)
        except Room.DoesNotExist:
            return Response({"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if user is in room
        if request.user not in room.users.all():
            return Response({"error": "Unauthorized to access this transcript"}, status=status.HTTP_403_FORBIDDEN)

        messages = Message.objects.filter(room=room).order_by('date')
        
        transcript_lines = [f"Transcript for Chat: {room_name}", "="*40, ""]
        
        for msg in messages:
            timestamp = msg.date.strftime("%Y-%m-%d %H:%M:%S")
            sender = msg.user.username
            content = msg.value
            
            # Indicate deletion in transcript to the user requesting it
            if msg.deleted_for_everyone:
                content = "[Message deleted]"
            elif msg.deleted_for_sender and request.user == msg.user:
                continue 
                
            transcript_lines.append(f"[{timestamp}] {sender}: {content}")

        text_content = "\n".join(transcript_lines)
        
        response = HttpResponse(text_content, content_type='text/plain')
        response['Content-Disposition'] = f'attachment; filename="transcript_{room_name}.txt"'
        return response


class ChatAnalysisView(APIView):
    """
    Passive Chat Analysis Engine.
    Analyzes recent messages in a room and updates both participants' profiles
    with extracted interests, conversation topics, and behavioral patterns.
    This can be triggered periodically or after a conversation ends.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, room_name):
        try:
            room = Room.objects.get(name=room_name)
        except Room.DoesNotExist:
            return Response({"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.user not in room.users.all():
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        # Get recent messages (last 50 for token efficiency)
        messages = Message.objects.filter(
            room=room,
            deleted_for_everyone=False
        ).order_by('-date')[:50]

        if messages.count() < 5:
            return Response({"message": "Not enough messages to analyze yet."}, status=status.HTTP_200_OK)

        # Build conversation text
        conversation = []
        for msg in reversed(list(messages)):
            conversation.append(f"{msg.user.username}: {msg.value}")

        conversation_text = "\n".join(conversation)

        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            
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

            response = model.generate_content(prompt)
            response_text = response.text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:-3]

            analysis = json.loads(response_text)
            participants_data = analysis.get("participants", {})

            updated_users = []
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

            return Response({
                "message": "Conversation analyzed. Profiles updated.",
                "updated_users": updated_users,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": f"Chat analysis failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
