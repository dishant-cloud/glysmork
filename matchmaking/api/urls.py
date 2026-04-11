from django.urls import path
from .views import JoinMatchmakingView, FriendshipActionView, SendChatNotificationView, GetNotificationsView, TestNotificationView, UpdateLocationView

urlpatterns = [
    path('join/', JoinMatchmakingView.as_view(), name='api-matchmaking-join'),
    path('friends/', FriendshipActionView.as_view(), name='api-friends'),
    path('notify/', SendChatNotificationView.as_view(), name='api-send-chat-notif'),
    path('notifications/', GetNotificationsView.as_view(), name='api-get-notifications'),
    path('test-notify/', TestNotificationView.as_view(), name='api-test-notify'),
    path('update-location/', UpdateLocationView.as_view(), name='update_location'),
]
