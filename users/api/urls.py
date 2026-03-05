from django.urls import path
from .views import ProfileDetailView, PublicProfileView, AIOnboardingQuizView, ImprovementBotView, LoginView

urlpatterns = [
    path('login/', LoginView.as_view(), name='api-login'),
    path('profile/', ProfileDetailView.as_view(), name='api-profile-detail'),
    path('profile/<str:username>/', PublicProfileView.as_view(), name='api-public-profile'),
    path('onboarding/analyze/', AIOnboardingQuizView.as_view(), name='api-onboarding-analyze'),
    path('improvement-bot/', ImprovementBotView.as_view(), name='api-improvement-bot'),
]
