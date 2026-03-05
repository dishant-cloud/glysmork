from django.urls import path
from .views import JoinMatchmakingView

urlpatterns = [
    path('join/', JoinMatchmakingView.as_view(), name='api-matchmaking-join'),
]
