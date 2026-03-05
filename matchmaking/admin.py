from django.contrib import admin
from .models import Loop, CallRequest


@admin.register(Loop)
class LoopAdmin(admin.ModelAdmin):
    list_display = ['user', 'gender', 'timestamp']
    list_filter = ['gender', 'timestamp']
    search_fields = ['user__username']


@admin.register(CallRequest)
class CallRequestAdmin(admin.ModelAdmin):
    list_display = ['sender', 'receiver', 'status', 'timestamp']
    list_filter = ['status', 'timestamp']
    search_fields = ['sender__username', 'receiver__username']
    list_editable = ['status']
