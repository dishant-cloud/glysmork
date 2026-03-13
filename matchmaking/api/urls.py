from django.urls import path
from .views import JoinMatchmakingView, FriendshipActionView, SupportChatView

urlpatterns = [
    path('join/', JoinMatchmakingView.as_view(), name='api-matchmaking-join'),
    path('friends/', FriendshipActionView.as_view(), name='api-friends'),
    path('support-chat/', SupportChatView.as_view(), name='api-support-chat'),
]
