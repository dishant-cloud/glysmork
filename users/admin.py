from django.contrib import admin
from .models import Profile, Report


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'age', 'gender', 'is_verified', 'is_banned', 'reports_received', 'last_quiz_taken']
    list_filter = ['is_verified', 'is_banned', 'gender', 'is_profile_public', 'show_ai_analysis']
    search_fields = ['user__username', 'user__email', 'bio']
    readonly_fields = ['psychological_profile', 'self_reported_traits', 'conversation_topics', 'last_quiz_taken']
    
    fieldsets = (
        ('User Info', {
            'fields': ('user', 'image', 'bio', 'gender', 'age', 'country', 'state')
        }),
        ('AI Profile Data', {
            'fields': ('psychological_profile', 'self_reported_traits', 'connection_preferences',
                       'interests', 'expertise_areas', 'conversation_topics', 'current_intent', 'last_quiz_taken'),
            'classes': ('collapse',),
        }),
        ('Privacy Settings', {
            'fields': ('is_profile_public', 'show_ai_analysis', 'hidden_data_fields'),
        }),
        ('Moderation', {
            'fields': ('is_verified', 'is_banned', 'reports_received'),
        }),
        ('Economy', {
            'fields': ('diamonds', 'call_price'),
        }),
    )


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['reporter', 'reported_user', 'status', 'timestamp', 'reason_preview']
    list_filter = ['status', 'timestamp']
    search_fields = ['reporter__username', 'reported_user__username', 'reason']
    list_editable = ['status']
    actions = ['mark_reviewed', 'mark_action_taken', 'ban_reported_user']

    def reason_preview(self, obj):
        return obj.reason[:80] + '...' if len(obj.reason) > 80 else obj.reason
    reason_preview.short_description = 'Reason'

    @admin.action(description='Mark selected reports as Reviewed')
    def mark_reviewed(self, request, queryset):
        queryset.update(status='reviewed')

    @admin.action(description='Mark selected reports as Action Taken')
    def mark_action_taken(self, request, queryset):
        queryset.update(status='action_taken')

    @admin.action(description='Ban the reported users')
    def ban_reported_user(self, request, queryset):
        for report in queryset:
            profile = report.reported_user.profile
            profile.is_banned = True
            profile.save(update_fields=['is_banned'])
        queryset.update(status='action_taken')
        self.message_user(request, f'{queryset.count()} user(s) banned.')
