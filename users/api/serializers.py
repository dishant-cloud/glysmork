from rest_framework import serializers
from users.models import Profile, Report
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'user', 'image', 'bio', 'gender', 'age', 'diamonds',
            'is_verified', 'psychological_profile', 'self_reported_traits',
            'connection_preferences', 'interests', 'expertise_areas',
            'conversation_topics', 'current_intent',
            'last_quiz_taken', 'is_profile_public',
            'show_ai_analysis', 'hidden_data_fields'
        ]
        read_only_fields = ['psychological_profile', 'last_quiz_taken', 'diamonds', 'is_verified', 'conversation_topics']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        
        request = self.context.get('request')
        if request and request.user != instance.user:
            if not instance.is_profile_public:
                return {'user': data['user'], 'message': 'This profile is private.'}
                
            for field in instance.hidden_data_fields:
                if field in data:
                    data.pop(field)
                    
            if not instance.show_ai_analysis:
                data.pop('psychological_profile', None)
                
        return data

class OnboardingQuizSerializer(serializers.Serializer):
    """
    Receives quiz answers covering psychology, interests, expertise, goals, and connection preferences.
    """
    answers = serializers.JSONField(help_text="Dictionary of question IDs and string answers.")
    connection_preferences = serializers.JSONField(help_text="What kind of people/conversations they seek.", required=False)
    interests = serializers.JSONField(help_text="List of topics they are interested in.", required=False)
    expertise = serializers.JSONField(help_text="List of topics they have expertise in.", required=False)

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['id', 'reported_user', 'reason', 'timestamp', 'status']
        read_only_fields = ['timestamp', 'status']
