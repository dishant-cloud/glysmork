from django.contrib import admin
from .models import CallLog

@admin.register(CallLog)
class CallLogAdmin(admin.ModelAdmin):
    list_display = ('call_id', 'caller', 'receiver', 'mode', 'status', 'duration_seconds', 'created_at')
    list_filter = ('mode', 'status', 'created_at')
    search_fields = ('caller__username', 'receiver__username', 'call_id')
