import logging
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth.models import User
from users.models import Profile, TrustEvent, Report, Block
from matchmaking.models import Friendship
from django.db import models

logger = logging.getLogger(__name__)

def apply_trust_event(user_id, event_type, points_change=0, reason=""):
    """
    Called after each meaningful event, triggers recalculation.
    """
    try:
        user = User.objects.get(id=user_id)
        TrustEvent.objects.create(
            user=user,
            event_type=event_type,
            points_change=points_change,
            reason=reason
        )
        # Recalculate
        calculate_trust_score(user_id)
    except User.DoesNotExist:
        pass

def calculate_trust_score(user_id):
    """
    Runs the full formula and updates the user record.
    """
    try:
        user = User.objects.get(id=user_id)
        profile = getattr(user, 'profile', None)
        if not profile:
            return 0
    except User.DoesNotExist:
        return 0

    now = timezone.now()
    raw_score = 0
    
    # ─────────────────────────────────────
    # VERIFICATION LAYER — max 35 points
    # ─────────────────────────────────────
    verification_score = 0
    if profile.phone_verified:
        verification_score += 20
    if profile.email_verified:
        verification_score += 8
    
    if profile.has_profile_photo:
        if profile.has_face_in_photo:
            verification_score += 7
        else:
            verification_score += 5

    verification_score = min(verification_score, 35)
    raw_score += verification_score

    # ─────────────────────────────────────
    # PROFILE LAYER — max 15 points
    # ─────────────────────────────────────
    profile_score = 0
    if len(profile.bio) > 20:
        profile_score += 5
    if len(profile.interests) >= 3:
        profile_score += 5
    if (now - user.date_joined).days >= 30:
        profile_score += 5

    profile_score = min(profile_score, 15)
    raw_score += profile_score

    # ─────────────────────────────────────
    # BEHAVIOUR LAYER — max 30 points
    # ─────────────────────────────────────
    behaviour_score = 0
    if profile.qualifying_sessions > 0:
        cr = profile.friendships_made / profile.qualifying_sessions
        cr = min(cr, 1.0)
        behaviour_score += int(cr * 15)
    
    if profile.calls_received > 0:
        ar = profile.calls_answered / profile.calls_received
        ar = min(ar, 1.0)
        behaviour_score += int(ar * 10)
    
    if profile.total_sessions > 0:
        ratio = profile.qualifying_sessions / profile.total_sessions
        behaviour_score += int(min(ratio * 5, 5))
    
    if profile.total_sessions >= 10 and profile.qualifying_sessions == 0:
        behaviour_score = min(behaviour_score, 5)

    behaviour_score = min(behaviour_score, 30)
    raw_score += behaviour_score

    # ─────────────────────────────────────
    # SOCIAL LAYER — max 20 points
    # ─────────────────────────────────────
    social_score = 0
    friend_count = Friendship.objects.filter(
        models.Q(from_user=user) | models.Q(to_user=user),
        status='accepted'
    ).count()

    if friend_count >= 10:
        social_score += 15
    else:
        social_score += int((friend_count / 10.0) * 15)
    
    friendships = Friendship.objects.filter(models.Q(from_user=user) | models.Q(to_user=user), status='accepted')
    friends_profiles = []
    for f in friendships:
        friend = f.to_user if f.from_user == user else f.from_user
        if hasattr(friend, 'profile'):
            friends_profiles.append(friend.profile.trust_score)
    
    if friends_profiles:
        avg_friend_trust = sum(friends_profiles) / len(friends_profiles)
        if avg_friend_trust > 70:
            social_score += 5

    social_score = min(social_score, 20)
    raw_score += social_score

    # ─────────────────────────────────────
    # PENALTIES
    # ─────────────────────────────────────
    penalties = 0

    valid_reports = Report.objects.filter(reported_user=user)
    
    last_report = valid_reports.order_by('-timestamp').first()
    if last_report and (now - last_report.timestamp).days > 180:
        penalties += (valid_reports.count() * 15) * 0.5
    else:
        penalties += valid_reports.count() * 15
        
    reports_7_days = valid_reports.filter(timestamp__gte=now - timedelta(days=7)).count()
    if reports_7_days >= 3:
        penalties += 40
        profile.flagged_for_review = True

    blocks_received_count = Block.objects.filter(blocked_user=user).count()
    penalties += blocks_received_count * 5

    if (now - user.date_joined).days < 1:
        penalties += 15

    if profile.device_fingerprint:
        flagged_devices = Profile.objects.filter(
            device_fingerprint=profile.device_fingerprint, 
            flagged_for_review=True
        ).exclude(user=user)
        if flagged_devices.exists():
            penalties += 10
            profile.flagged_for_review = True
            
    if blocks_received_count >= 10:
        profile.flagged_for_review = True

    raw_score -= penalties

    # ─────────────────────────────────────
    # DECAY / RECOVERY RULES
    # ─────────────────────────────────────
    last_bad_event = TrustEvent.objects.filter(user=user, points_change__lt=0).order_by('-created_at').first()
    if last_bad_event and (now - last_bad_event.created_at).days >= 60:
        weeks_clean = (now - last_bad_event.created_at).days // 7
        raw_score += weeks_clean

    days_inactive = (now - profile.last_seen).days
    if days_inactive >= 30:
        weeks_inactive = days_inactive // 7
        decay = weeks_inactive * 2
        raw_score -= decay

    final_score = max(0, min(100, int(raw_score)))

    if days_inactive >= 30 and raw_score < 20 and (raw_score + decay) >= 20:
        final_score = max(20, final_score)

    profile.trust_score = final_score

    if final_score >= 80:
        profile.trust_tier = 'trusted'
    elif final_score >= 55:
        profile.trust_tier = 'established'
    elif final_score >= 30:
        profile.trust_tier = 'new'
    else:
        profile.trust_tier = 'flagged'
        profile.flagged_for_review = True

    profile.trust_last_calculated_at = now
    profile.save()

    return final_score
