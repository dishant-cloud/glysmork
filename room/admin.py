from django.contrib import admin
from .models import Room, Message


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at', 'user_count', 'message_count']
    search_fields = ['name', 'users__username']
    filter_horizontal = ['users']

    def user_count(self, obj):
        return obj.users.count()
    user_count.short_description = 'Users'

    def message_count(self, obj):
        return obj.message_set.count()
    message_count.short_description = 'Messages'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['user', 'room', 'value_preview', 'date', 'is_read', 'deleted_for_everyone']
    list_filter = ['is_read', 'deleted_for_everyone', 'deleted_for_sender', 'date']
    search_fields = ['user__username', 'value', 'room__name']
    readonly_fields = ['date', 'read_timestamp', 'deleted_timestamp']

    def value_preview(self, obj):
        return obj.value[:60] + '...' if len(obj.value) > 60 else obj.value
    value_preview.short_description = 'Message'
