from django.urls import path
from .views import ProfileDetailView, PublicProfileView, AIOnboardingQuizView, AIOnboardingChatView, ImprovementBotView, LoginView, RegisterView, OnlineCountView, HeartbeatView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='api-register'),
    path('login/', LoginView.as_view(), name='api-login'),
    path('profile/', ProfileDetailView.as_view(), name='api-profile-detail'),
    path('profile/<str:username>/', PublicProfileView.as_view(), name='api-public-profile'),
    path('onboarding/analyze/', AIOnboardingQuizView.as_view(), name='api-onboarding-analyze'),
    path('onboarding/chat/', AIOnboardingChatView.as_view(), name='api-onboarding-chat'),
    path('improvement-bot/', ImprovementBotView.as_view(), name='api-improvement-bot'),
    path('online-count/', OnlineCountView.as_view(), name='api-online-count'),
    path('heartbeat/', HeartbeatView.as_view(), name='api-heartbeat'),
]

