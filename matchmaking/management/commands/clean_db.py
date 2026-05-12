"""
Management command to clean up transient database records.
Run: python manage.py clean_db
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from matchmaking.models import ChatNotification, MatchHistory, CallRequest, Loop
from room.models import Room, Message

class Command(BaseCommand):
    help = "Cleans up unnecessary and old database records to save space"

    def handle(self, *args, **options):
        now = timezone.now()
        
        self.stdout.write("Starting database cleanup...")

        # 1. Delete Chat Notifications older than 24 hours
        old_notifs = ChatNotification.objects.filter(created_at__lt=now - timedelta(days=1))
        notifs_count, _ = old_notifs.delete()
        self.stdout.write(f"Deleted {notifs_count} old Chat Notifications.")

        # 2. Delete Call Requests older than 24 hours
        old_calls = CallRequest.objects.filter(timestamp__lt=now - timedelta(days=1))
        calls_count, _ = old_calls.delete()
        self.stdout.write(f"Deleted {calls_count} old Call Requests.")

        # 3. Delete Match History older than 7 days
        old_history = MatchHistory.objects.filter(timestamp__lt=now - timedelta(days=7))
        history_count, _ = old_history.delete()
        self.stdout.write(f"Deleted {history_count} old Match History records.")

        # 4. Delete Empty Discovery Session Rooms older than 2 hours
        # A room is empty if it has no messages.
        two_hours_ago = now - timedelta(hours=2)
        empty_session_rooms = Room.objects.filter(
            chat_type='session',
            created_at__lt=two_hours_ago,
            message__isnull=True
        )
        empty_rooms_count, _ = empty_session_rooms.delete()
        self.stdout.write(f"Deleted {empty_rooms_count} empty temporary Session Rooms.")

        # 5. Optional: Delete Loops that haven't been seen in 24 hours (stuck in queue)
        old_loops = Loop.objects.filter(last_seen__lt=now - timedelta(days=1))
        loops_count, _ = old_loops.delete()
        self.stdout.write(f"Deleted {loops_count} abandoned matchmaking Loops.")

        self.stdout.write(self.style.SUCCESS("Database cleanup completed successfully!"))
