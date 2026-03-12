import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.message_history = []

    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        
        # Sanitize room name for group usage
        import re
        safe_room_name = re.sub(r'[^a-zA-Z0-9_\-]', '', self.room_name)
        self.room_group_name = f'chat_{safe_room_name}'
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        print(f"DEBUG: User {self.scope['user']} JOINED group {self.room_group_name} (Channel: {self.channel_name})")

        # Notify others that a new user has joined
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'sender': self.channel_name,
                'username': self.scope['user'].username if self.scope['user'].is_authenticated else 'Anonymous'
            }
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print(f"DEBUG: User {self.scope['user']} LEFT group {self.room_group_name}")
        
        # Notify others
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_left',
                'sender': self.channel_name
            }
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'chat_message':
            message = data['message']
            username = data.get('username', 'Anonymous')

            # Build rolling history for AI analysis
            self.message_history.append(f"{username}: {message}")
            if len(self.message_history) > 10:
                self.message_history = self.message_history[-10:]

            # Send message to room group immediately for real-time feel
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'username': username
                }
            )

            # --- AI FRAUD / INTENT MONITORING ---
            # Trigger analysis every 5 messages to avoid extreme API spam
            if len(self.message_history) % 5 == 0:
                import asyncio
                # Run the sync Gemini call in a background thread so it doesn't block WebSockets
                asyncio.create_task(self.analyze_chat_history(username))
        
        elif message_type == 'video_signal':
            # Forward video signals (offer, answer, ice candidates)
            sender = self.channel_name
            signal = data['signal']
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'video_signal',
                    'signal': signal,
                    'sender': sender
                }
            )
        
        elif message_type == 'force_exit':
            print(f"DEBUG: Received force_exit from {self.scope['user']} in {self.room_group_name}")
            # Broadcast to everyone in the room that the session is terminated
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'force_exit',
                    'sender': self.channel_name
                }
            )

    # Receive message from room group
    async def chat_message(self, event):
        message = event['message']
        username = event['username']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': message,
            'username': username
        }))

    async def video_signal(self, event):
        # Don't send the signal back to the person who sent it!
        if self.channel_name != event['sender']:
            await self.send(text_data=json.dumps({
                'type': 'video_signal',
                'signal': event['signal']
            }))

    async def force_exit(self, event):
        """ Signal both users to exit the room """
        print(f"DEBUG: Broadcasting force_exit to client in {self.room_group_name}")
        await self.send(text_data=json.dumps({
            'type': 'force_exit'
        }))

    async def user_left(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_left',
            'sender': event['sender']
        }))

    async def user_joined(self, event):
        if self.channel_name != event['sender']:
            await self.send(text_data=json.dumps({
                'type': 'user_joined',
                'sender': event['sender'],
                'username': event.get('username', 'Unknown')
            }))

    async def analyze_chat_history(self, recent_sender_username):
        """
        Sends the rolling 10-message chat history to Gemini to detect "cap", 
        creepy behavior, or fraud. If found, generates an image and alerts the room.
        """
        if not self.message_history:
            return

        chat_log = "\n".join(self.message_history)
        
        # We must wrap the sync Gemini call in a thread
        from asgiref.sync import sync_to_async
        import google.generativeai as genai
        import json
        import urllib.parse
        from django.utils import timezone
        
        @sync_to_async
        def call_gemini():
            try:
                genai.configure(api_key="AIzaSyCMXK_v5nP0TcWT0FMlPKUhOS5WbA51WrQ")
                model = genai.GenerativeModel('gemini-2.5-flash')
                prompt = f"""
                You are a ruthless AI moderator monitoring a live chat between two people.
                Read this transcript of the last 10 messages:
                
                {chat_log}
                
                Analyze the intent of '{recent_sender_username}'. Are they being manipulative, overly creepy, asking for money, or acting like a fraudster/bot?
                
                Respond ONLY in JSON.
                {{
                    "is_dangerous": boolean,
                    "reason": "short explanation if dangerous, else null",
                    "image_prompt": "If dangerous, write a 10 word visual prompt describing them as a monster or fraud, else null"
                }}
                """
                response = model.generate_content(prompt)
                
                text = response.text.strip()
                if text.startswith("```json"):
                    text = text[7:-3]
                
                return json.loads(text)
            except Exception as e:
                return {"error": str(e)}

        analysis = await call_gemini()
        
        if analysis and analysis.get("is_dangerous"):
            # They failed the vibe check. Generate the warning image.
            base_prompt = analysis.get("image_prompt", "An abstract digital monster representing deceit")
            style_modifiers = ", dark glitch art, red warning neon, ominous, 4k"
            encoded_prompt = urllib.parse.quote(base_prompt + style_modifiers)
            pollinations_url = f"https://pollinations.ai/p/{encoded_prompt}?width=400&height=400&nologo=true&seed={timezone.now().microsecond}"
            
            # Broadcast the alert to the room!
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'analysis_alert',
                    'username': recent_sender_username,
                    'reason': analysis.get("reason"),
                    'image_url': pollinations_url
                }
            )

    async def analysis_alert(self, event):
        """ Handles the broadcasted AI warning """
        await self.send(text_data=json.dumps({
            'type': 'analysis_alert',
            'username': event['username'],
            'reason': event['reason'],
            'image_url': event['image_url']
        }))

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return

        self.group_name = f"user_{self.user.id}"

        # Join user group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave user group
        if self.user.is_authenticated:
             await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    # Receive message from room group
    async def notification_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'message': event['message']
        }))