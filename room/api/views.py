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

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "AIzaSyCMXK_v5nP0TcWT0FMlPKUhOS5WbA51WrQ"))


class RoomDetailView(APIView):
    """
    Returns the list of usernames in a room. Open to all so the chat
    frontend can display who you are connected to without session auth.
    """
    permission_classes = []  # AllowAny

    def get(self, request, room_name):
        try:
            room = Room.objects.get(name=room_name)
        except Room.DoesNotExist:
            return Response({"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND)
        usernames = list(room.users.values_list('username', flat=True))
        return Response({
            "room": room_name, 
            "users": usernames,
            "is_active": room.is_active
        })

class RoomStatusView(APIView):
    """
    Lightweight check to see if a room is still active.
    Used by frontend polling fallback for synchronized exit.
    """
    permission_classes = [] 

    def get(self, request, room_name):
        try:
            room = Room.objects.get(name=room_name)
            return Response({"is_active": room.is_active})
        except Room.DoesNotExist:
            return Response({"is_active": False})

class RoomCloseView(APIView):
    """
    Sets a room's is_active status to False.
    Called when a user confirms severance of the connection.
    """
    permission_classes = [] # AllowAny for now
    
    def post(self, request, room_name):
        try:
            room = Room.objects.get(name=room_name)
            room.is_active = False
            room.save()
            return Response({"status": "closed"})
        except Room.DoesNotExist:
            return Response({"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

class ConversationListView(APIView):
    """
    Returns all rooms the user has participated in, 
    formatted as an Inbox/Conversation list.
    """
    def _resolve_user(self, request):
        if request.user.is_authenticated:
            return request.user
        username = request.query_params.get('username') or request.data.get('username')
        if username:
            from django.contrib.auth.models import User as AuthUser
            try:
                return AuthUser.objects.get(username=username)
            except AuthUser.DoesNotExist:
                return None
        return None

    def get(self, request):
        user = self._resolve_user(request)
        if not user:
            return Response({"error": "No user context"}, status=status.HTTP_401_UNAUTHORIZED)
        
        rooms = user.rooms.all().order_by('-created_at')
        data = []
        for room in rooms:
            partner = room.users.exclude(id=user.id).first()
            last_message = Message.objects.filter(room=room).order_by('-date').first()
            
            data.append({
                "room_name": room.name,
                "partner_username": partner.username if partner else "Disconnected Node",
                "partner_image": partner.profile.persona_image_url if partner and hasattr(partner, 'profile') else None,
                "last_message": last_message.value[:50] if last_message else "No messages yet",
                "last_message_time": last_message.date.strftime("%Y-%m-%d %H:%M") if last_message else None,
                "is_active": room.is_active
            })
        return Response(data)


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
    Accepts `username` as query param (GET) or body field (POST) when session auth is unavailable.
    """
    permission_classes = []  # AllowAny — user resolved via username param

    def _resolve_user(self, request):
        """Return authenticated user or look up by username from request data."""
        if request.user.is_authenticated:
            return request.user
        from django.contrib.auth.models import User as AuthUser
        username = request.query_params.get('username') or request.data.get('username')
        if username:
            try:
                return AuthUser.objects.get(username=username)
            except AuthUser.DoesNotExist:
                return None
        return None

    def get(self, request, room_name):
        try:
            room = Room.objects.get(name=room_name)
        except Room.DoesNotExist:
            return Response({"error": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

        requesting_user = self._resolve_user(request)

        messages = Message.objects.filter(room=room).order_by('date')
        data = []
        for msg in messages:
            # Skip if deleted for this user
            if requesting_user and msg.deleted_for_sender and msg.user == requesting_user:
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

        requesting_user = self._resolve_user(request)
        if not requesting_user:
            return Response({"error": "Provide a valid username."}, status=status.HTTP_400_BAD_REQUEST)

        text = request.data.get('text')
        if not text:
            return Response({"error": "Message text is required"}, status=status.HTTP_400_BAD_REQUEST)

        msg = Message.objects.create(
            user=requesting_user,
            room=room,
            value=text
        )

        # Broadcast via Channels (best effort — won't fail the request if Redis is down)
        try:
            import re
            safe_room_name = re.sub(r'[^a-zA-Z0-9_\-]', '', room_name)
            channel_layer = get_channel_layer()
            if channel_layer:
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
        except Exception as e:
            pass  # Real-time push failed but message is saved — frontend will poll

        return Response({
            "id": msg.id,
            "sender": msg.user.username,
            "text": msg.value,
            "isRead": msg.is_read,
            "deletedForEveryone": msg.deleted_for_everyone,
            "timestamp": msg.date.strftime("%I:%M %p")
        }, status=status.HTTP_201_CREATED)


