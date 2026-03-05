from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
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

        import re
        safe_room_name = re.sub(r'[^a-zA-Z0-9_\-]', '', message.room.name)
        channel_layer = get_channel_layer()

        if action == 'mark_read':
            if message.user != request.user and not message.is_read:
                message.is_read = True
                message.read_timestamp = timezone.now()
                message.save()
                
                # Broadcast read receipt
                async_to_sync(channel_layer.group_send)(
                    f'chat_{safe_room_name}',
                    {
                        'type': 'message_read',
                        'id': message.id
                    }
                )

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
                
                # Broadcast deletion
                async_to_sync(channel_layer.group_send)(
                    f'chat_{safe_room_name}',
                    {
                        'type': 'message_deleted',
                        'id': message.id
                    }
                )

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
    Triggers the background Celery task to analyze recent messages in a room 
    and update both participants' profiles.
    Returns immediately.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, room_name):
        try:
            room = Room.objects.get(name=room_name)
        except Room.DoesNotExist:
            return Response({"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.user not in room.users.all():
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        # Trigger Celery Task asynchronously
        from room.tasks import generate_chat_analysis_task
        generate_chat_analysis_task.delay(room_name)

        return Response({
            "message": "Chat analysis started in the background."
        }, status=status.HTTP_202_ACCEPTED)


class MessageListView(APIView):
    """
    GET: Retrieve recent messages for a room.
    POST: Send a new message to the room.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, room_name):
        try:
            room = Room.objects.get(name=room_name)
        except Room.DoesNotExist:
            return Response({"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.user not in room.users.all():
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        messages = Message.objects.filter(room=room).order_by('date')
        
        data = []
        for msg in messages:
            # Skip if deleted for this user
            if msg.deleted_for_sender and msg.user == request.user:
                continue
            
            text = msg.value
            if msg.deleted_for_everyone:
                text = "This message was deleted."

            data.append({
                "id": msg.id,
                "sender": msg.user.username,
                "text": text,
                "isRead": msg.is_read,
                "deletedForEveryone": msg.deleted_for_everyone,
                "timestamp": msg.date.strftime("%I:%M %p")
            })

        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, room_name):
        try:
            room = Room.objects.get(name=room_name)
        except Room.DoesNotExist:
            return Response({"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.user not in room.users.all():
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        text = request.data.get('text')
        if not text:
            return Response({"error": "Message text is required"}, status=status.HTTP_400_BAD_REQUEST)

        msg = Message.objects.create(
            user=request.user,
            room=room,
            value=text
        )

        # Broadcast via Channels
        import re
        safe_room_name = re.sub(r'[^a-zA-Z0-9_\-]', '', room_name)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{safe_room_name}',
            {
                'type': 'chat_message',
                'id': msg.id,
                'message': msg.value,
                'username': msg.user.username,
                'timestamp': msg.date.strftime("%I:%M %p"),
                'isRead': msg.is_read,
                'deletedForEveryone': msg.deleted_for_everyone
            }
        )

        return Response({
            "id": msg.id,
            "sender": msg.user.username,
            "text": msg.value,
            "isRead": msg.is_read,
            "deletedForEveryone": msg.deleted_for_everyone,
            "timestamp": msg.date.strftime("%I:%M %p")
        }, status=status.HTTP_201_CREATED)

