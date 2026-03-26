import os
import json
from dotenv import load_dotenv

load_dotenv()

# Database Setup - Using SQLite for local testing to match the Django setup seamlessly
# Note: Part 7 asked for Postgres UUIDs, but to run this easily on your local machine with the existing setup, 
# we are using SQLite. For production, switch this to a PostgreSQL URL.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///db.sqlite3")

# Gemini Setup
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
print(f"DEBUG: GEMINI_API_KEY loaded: {'Yes' if GEMINI_API_KEY else 'No'}")
if GEMINI_API_KEY:
    print(f"DEBUG: Key starts with: {GEMINI_API_KEY[:8]}...")


# The Buckets definition as provided
DEFAULT_BUCKETS = [
    {
        "name": "SERIOUS_RELATIONSHIP",
        "description": "covers marriage, long-term commitment, finding a life partner, deep emotional bonds, wanting to settle down",
        "guidelines": "The user is looking for a serious romance and long-term commitment. Ask about their core values, long-term life vision (marriage, kids, lifestyle), dealbreakers in a life partner, and what their ideal dynamic looks like."
    },
    {
        "name": "CASUAL_DATING",
        "description": "covers casual dates, situationships, casual romance, short-term connections, testing the waters",
        "guidelines": "The user is looking for casual dating or short-term romance. Ask about what kind of fun/chemistry they seek, their current boundaries or what they are avoiding, and what an ideal date looks like."
    },
    {
        "name": "COMPANIONSHIP",
        "description": "covers loneliness, wanting friends, socialising, rebuilding a social circle, new to a city, feeling disconnected, wanting someone to talk to regularly, platonic closeness",
        "guidelines": "The user seeks companionship and friendship. Ask about their current social situation, what kind of friend they want (activity partner vs deep talks), and how often they'd like to talk."
    },
    {
        "name": "EMOTIONAL_SUPPORT",
        "description": "covers grief, breakup recovery, burnout, anxiety, depression, processing difficult life events, wanting someone who has been through the same thing, needing to be heard, needing a safe space to talk",
        "guidelines": "The user needs emotional support. Be gentle. Ask what they are going through (if they want to share) and what kind of support they need (just listening vs advice vs shared experience)."
    },
    {
        "name": "FUN_AND_ENTERTAINMENT",
        "description": "covers gaming, binge watching, banter, travel buddy, sports partner, fitness partner, hobby partner, casual fun conversations, spontaneous connections",
        "guidelines": "The user is here for fun. Ask about their specific hobbies (gaming, sports, etc) and what exact activities they want to do with someone else."
    },
    {
        "name": "PERSONAL_GROWTH",
        "description": "covers accountability partner, habit building, fitness goals, mindset, self improvement, wanting someone who challenges them, mentorship in life skills",
        "guidelines": "The user wants personal growth. Ask about their specific goals, what areas they want to improve, and how they want an accountability partner to push them."
    },
    {
        "name": "PROFESSIONAL",
        "description": "covers career networking, finding a mentor, being a mentor, job search support, co-founder search, collaborators, business networking, industry peers, skill building",
        "guidelines": "The user is here for professional reasons. Ask about their industry, their career goals, and specifically what kind of professional connection they seek (mentor, cofounder, peer)."
    },
    {
        "name": "CREATIVE_COLLABORATION",
        "description": "covers finding a co-creator, music, writing, art, film, coding projects, content creation, design, any creative partnership",
        "guidelines": "The user wants creative collaboration. Ask about their medium (music, writing, code), their current projects, and what skills they need in a collaborator."
    },
    {
        "name": "KNOWLEDGE_EXCHANGE",
        "description": "covers language exchange, skill swap, learning something specific, teaching something, academic support, intellectual conversations, debate partner",
        "guidelines": "The user is here for knowledge exchange. Ask exactly what they want to learn or teach, and how they prefer to exchange information."
    },
    {
        "name": "COMMUNITY",
        "description": "covers finding people who share an identity or experience — cultural community, religious community, LGBTQ, expat, diaspora, neurodivergent, chronic illness, parenting, niche interests, political discourse",
        "guidelines": "The user seeks a specific community. Ask about what specific identity or experience they want to connect over, and what they hope to get from that community."
    },
    {
        "name": "SPIRITUAL",
        "description": "covers spiritual seeking, faith discussions, meditation, purpose, meaning of life, connecting with people on a deeper philosophical or spiritual level",
        "guidelines": "The user is seeking spiritual or philosophical connection. Ask about their current beliefs/practices and what kind of deeper discussions they are looking for."
    }
]

# For Part 6 - Synonym mapping
COMMON_SYNONYMS = {
    "HUMOROUS": "FUNNY",
    "TRANQUIL": "CALM",
    "EMPATHETIC": "CARING",
    "MOTIVATED": "DRIVEN",
    "TRANSPARENT": "HONEST",
    "OUTGOING": "SOCIAL",
    "WITTY": "FUNNY",
    "CLEVER": "SMART",
    "COMPASSIONATE": "CARING"
}
