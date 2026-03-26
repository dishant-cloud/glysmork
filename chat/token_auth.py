from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser, User
from urllib.parse import parse_qs

@database_sync_to_async
def get_user_from_token(token):
    from rest_framework_simplejwt.tokens import AccessToken
    try:
        access_token = AccessToken(token)
        user = User.objects.get(id=access_token['user_id'])
        print(f"WS AUTH: Successful for user {user.username}")
        return user
    except Exception as e:
        print(f"WS AUTH ERROR: Token invalid or expired. Error: {e}")
        return AnonymousUser()

class TokenAuthMiddleware:
    """
    Middleware to authenticate WebSocket connections via a JWT token in the query string.
    Example: ws://localhost:8000/ws/chat/room_name/?token=<jwt_token>
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)
