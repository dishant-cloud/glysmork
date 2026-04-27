from django.urls import path
from .views import ProfileDetailView, PublicProfileView, AIOnboardingQuizView, ImprovementBotView, LoginView, RegisterView, GoogleLoginView, FacebookLoginView, OnlineCountView, HeartbeatView, AnalyticsView, TrustScoreView, ReportUserView, BlockUserView, ImageUploadView, debug_cache
from .subscriptions import StripeCheckoutView, StripeWebhookView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='api-register'),
    path('login/', LoginView.as_view(), name='api-login'),
    path('google-login/', GoogleLoginView.as_view(), name='api-google-login'),
    path('facebook-login/', FacebookLoginView.as_view(), name='api-facebook-login'),
    path('profile/', ProfileDetailView.as_view(), name='api-profile-detail'),
    path('profile/image/', ImageUploadView.as_view(), name='api-profile-image'),
    path('profile/<str:username>/', PublicProfileView.as_view(), name='api-public-profile'),
    path('profile/<str:username>/trust/', TrustScoreView.as_view(), name='api-trust-score'),
    path('profile/<str:username>/report/', ReportUserView.as_view(), name='api-report-user'),
    path('profile/<str:username>/block/', BlockUserView.as_view(), name='api-block-user'),
    path('onboarding/analyze/', AIOnboardingQuizView.as_view(), name='api-onboarding-analyze'),
    path('improvement-bot/', ImprovementBotView.as_view(), name='api-improvement-bot'),
    path('online-count/', OnlineCountView.as_view(), name='api-online-count'),
    path('heartbeat/', HeartbeatView.as_view(), name='api-heartbeat'),
    path('analytics/', AnalyticsView.as_view(), name='api-analytics'),
    path('debug-cache/', debug_cache, name='api-debug-cache'),
    
    # Subscriptions
    path('subscription/checkout/', StripeCheckoutView.as_view(), name='api-subscription-checkout'),
    path('subscription/webhook/', StripeWebhookView.as_view(), name='api-subscription-webhook'),
]
