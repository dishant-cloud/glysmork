from django.urls import path
from .views import ProfileDetailView, PublicProfileView, AIOnboardingQuizView, AIOnboardingChatView, ImprovementBotView, LoginView, RegisterView, OnlineCountView, HeartbeatView, AnalyticsView, ImageUploadView, TrustScoreView, ReportUserView, BlockUserView, debug_cache

urlpatterns = [
    path('register/', RegisterView.as_view(), name='api-register'),
    path('login/', LoginView.as_view(), name='api-login'),
    path('profile/', ProfileDetailView.as_view(), name='api-profile-detail'),
    path('profile/upload-photo/', ImageUploadView.as_view(), name='api-profile-upload-photo'),
    path('profile/<str:username>/', PublicProfileView.as_view(), name='api-public-profile'),
    path('profile/<str:username>/trust/', TrustScoreView.as_view(), name='api-trust-score'),
    path('profile/<str:username>/report/', ReportUserView.as_view(), name='api-report-user'),
    path('profile/<str:username>/block/', BlockUserView.as_view(), name='api-block-user'),
    path('onboarding/analyze/', AIOnboardingQuizView.as_view(), name='api-onboarding-analyze'),
    path('onboarding/chat/', AIOnboardingChatView.as_view(), name='api-onboarding-chat'),
    path('improvement-bot/', ImprovementBotView.as_view(), name='api-improvement-bot'),
    path('online-count/', OnlineCountView.as_view(), name='api-online-count'),
    path('heartbeat/', HeartbeatView.as_view(), name='api-heartbeat'),
    path('analytics/', AnalyticsView.as_view(), name='api-analytics'),
    path('debug-cache/', debug_cache, name='api-debug-cache'),
]
