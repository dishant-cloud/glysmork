from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q
from matchmaking.models import OfflineSearch, MatchHistory, ChatNotification
from room.models import Room
from users.models import Profile
import os
import json
from groq_client import groq_generate

class Command(BaseCommand):
    help = 'Processes offline matchmaking requests'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting offline matchmaking engine...'))
        
        # 1. Prune stale offline searches ( older than 24 hours without refresh )
        stale_threshold = timezone.now() - timezone.timedelta(hours=24)
        OfflineSearch.objects.filter(daily_refresh_timestamp__lt=stale_threshold).update(is_active=False)
        
        # 2. Get active searches
        active_searches = OfflineSearch.objects.filter(is_active=True, matches_found__lt=4)
        
        genai_key = os.environ.get("GEMINI_API_KEY")  # kept for future embedding use

        for search in active_searches:
            user = search.user
            self.stdout.write(f"Processing search for node: {user.username}")
            
            # Get already matched users
            history_ids = MatchHistory.objects.filter(Q(user1=user) | Q(user2=user)).values_list('user1_id', 'user2_id')
            excluded_ids = {user.id}
            for u1, u2 in history_ids:
                excluded_ids.add(u1)
                excluded_ids.add(u2)
            
            # Find potential candidates in Profile
            candidates = Profile.objects.exclude(user_id__in=excluded_ids).filter(is_profile_public=True)
            
            # Apply basic filters
            if search.gender_filter != 'A':
                candidates = candidates.filter(gender=search.gender_filter)
            if search.location_filter:
                candidates = candidates.filter(location__icontains=search.location_filter)
            
            # Limit candidates to scan (for performance)
            candidates = candidates.order_by('?')[:20]
            
            for candidate_profile in candidates:
                candidate = candidate_profile.user
                
                # Check for Match
                prompt = f"""
                Analyze the compatibility between two users for a profound connection.
                User A Intent: {search.intent}
                User B Bio: {candidate_profile.bio}
                User B Interests: {candidate_profile.interests}
                User B Expertise: {candidate_profile.expertise_areas}
                
                Respond ONLY with a JSON object: {{"score": 0-100, "reason": "brief explanation"}}
                High score (>80) means a great match.
                """
                
                try:
                    response_text = groq_generate(prompt)
                    res_json = json.loads(response_text.strip().replace('```json', '').replace('```', ''))
                    
                    if res_json.get('score', 0) >= 80:
                        # MATCH FOUND!
                        self.stdout.write(self.style.SUCCESS(f"  Match discovered: {candidate.username} (Score: {res_json['score']})"))
                        
                        # Create room
                        sorted_u = sorted([user.username, candidate.username])
                        room_name = f"offline_{sorted_u[0]}_{sorted_u[1]}"
                        Room.objects.get_or_create(name=room_name)
                        
                        # Create Notification for BOTH (if they are still searching)
                        ChatNotification.objects.create(
                            sender=user,
                            receiver=candidate,
                            room_name=room_name,
                            message=f"Neural Match Found: Based on your offline search, we found {user.username}."
                        )
                        ChatNotification.objects.create(
                            sender=candidate,
                            receiver=user,
                            room_name=room_name,
                            message=f"Neural Match Found: {candidate.username} matches your criteria."
                        )
                        
                        # Log History
                        MatchHistory.objects.create(
                            user1=user if user.id < candidate.id else candidate,
                            user2=candidate if user.id < candidate.id else user
                        )
                        
                        search.matches_found += 1
                        if search.matches_found >= 4:
                            search.is_active = False
                            break
                        search.save()
                        
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  AI analysis error: {str(e)}"))
            
            search.save()

        self.stdout.write(self.style.SUCCESS('Offline matchmaking cycle complete.'))
