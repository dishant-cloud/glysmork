from django.urls import path
from .views import MessageActionView, TranscriptDownloadView, ChatAnalysisView, MessageListView, RoomDetailView, RoomStatusView, RoomCloseView, ConversationListView

urlpatterns = [
    path('conversations/', ConversationListView.as_view(), name='api-conversations'),
    path('<str:room_name>/', RoomDetailView.as_view(), name='api-room-detail'),
    path('<str:room_name>/status/', RoomStatusView.as_view(), name='api-room-status'),
    path('<str:room_name>/close/', RoomCloseView.as_view(), name='api-room-close'),
    path('<str:room_name>/messages/', MessageListView.as_view(), name='api-room-messages'),
    path('messages/<int:message_id>/action/', MessageActionView.as_view(), name='api-message-action'),
    path('<str:room_name>/transcript/', TranscriptDownloadView.as_view(), name='api-room-transcript'),
    path('<str:room_name>/analyze/', ChatAnalysisView.as_view(), name='api-room-analyze'),
]



