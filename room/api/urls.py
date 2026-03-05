from django.urls import path
from .views import MessageActionView, TranscriptDownloadView, ChatAnalysisView

urlpatterns = [
    path('messages/<int:message_id>/action/', MessageActionView.as_view(), name='api-message-action'),
    path('room/<str:room_name>/transcript/', TranscriptDownloadView.as_view(), name='api-room-transcript'),
    path('room/<str:room_name>/analyze/', ChatAnalysisView.as_view(), name='api-room-analyze'),
]

