from django.urls import path
from .views import JoinMatchmakingView, FriendshipActionView, SendChatNotificationView, GetNotificationsView

urlpatterns = [
    path('join/', JoinMatchmakingView.as_view(), name='api-matchmaking-join'),
    path('friends/', FriendshipActionView.as_view(), name='api-friends'),
    path('notify/', SendChatNotificationView.as_view(), name='api-send-chat-notif'),
    path('notifications/', GetNotificationsView.as_view(), name='api-get-notifications'),
]
