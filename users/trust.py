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
    # ACCOUNT AGE LAYER — max 50 points
    # ─────────────────────────────────────
    # Start at 10 points on day 0, gain 1 point per day up to 50 max points
    days_active = (now - user.date_joined).days
    age_score = min(10 + days_active, 50)
    raw_score += age_score

    # ─────────────────────────────────────
    # FEEDBACK LAYER — max 50 points
    # ─────────────────────────────────────
    # Start with a perfect 50 points, deduct based on negative feedback
    feedback_score = 50
    
    valid_reports = Report.objects.filter(reported_user=user)
    blocks_received = Block.objects.filter(blocked_user=user)
    
    # Deduct 15 points per report, 5 points per block
    deductions = (valid_reports.count() * 15) + (blocks_received.count() * 5)
    
    # Severe penalty if recently reported heavily
    reports_7_days = valid_reports.filter(timestamp__gte=now - timedelta(days=7)).count()
    if reports_7_days >= 3:
        deductions += 40
        profile.flagged_for_review = True
        
    if blocks_received.count() >= 10:
        profile.flagged_for_review = True

    feedback_score = max(0, feedback_score - deductions)
    raw_score += feedback_score

    # ─────────────────────────────────────
    # DECAY / RECOVERY RULES
    # ─────────────────────────────────────
    # Recover some points over time if no recent bad events
    last_bad_event = TrustEvent.objects.filter(user=user, points_change__lt=0).order_by('-created_at').first()
    if last_bad_event and (now - last_bad_event.created_at).days >= 30:
        months_clean = (now - last_bad_event.created_at).days // 30
        raw_score += (months_clean * 5)

    final_score = max(0, min(100, int(raw_score)))

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
