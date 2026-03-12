from .views import JoinMatchmakingView, FriendshipActionView

urlpatterns = [
    path('join/', JoinMatchmakingView.as_view(), name='api-matchmaking-join'),
    path('friends/', FriendshipActionView.as_view(), name='api-friends'),
]
