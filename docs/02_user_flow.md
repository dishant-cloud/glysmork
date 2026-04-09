# 02 User Flow

## 1. Registration & The Psychological Profiler
When a user arrives at Glysmork, they initiate authentication in the Next.js frontend. Almost immediately upon finishing base authentication, they are redirected to the **Onboarding Service (FastAPI)**.
Here, they take the Psychometric Questionnaire. The AI silently runs in the background analyzing their answers, compiling:
1. `interests` and `expertise_areas`
2. `psychological_profile` (Personality deep dive)
3. `connection_preferences` (Who they want)

This data is saved to their global `Profile` model in the master database.

## 2. Matchmaking Intent (The Smart Search)
Once onboarded, the user accesses the Dashboard. To find a connection, they type a natural language intent into the Smart Search input box (e.g., `"I want to find a game dev who hates python"`).

The frontend posts this intent to `JoinMatchmakingView` in the Django application `/matchmaking/api/views.py`.

At this stage, the user's intent hits the **Hybrid AST Engine**:
1. Gemini converts the query into a logical tree (Abstract Syntax Tree).
2. The Numpy fallback engine scores everyone in the database who is online against the request, using pure cosine similarity.
3. The engine optionally factors in the searcher's own `onboarding_data` baseline to ensure mutual chemistry.

## 3. The Match and Room Creation
The engine returns the highest-scoring candidate. 
Once both peers agree, Django explicitly creates a `Room`. A `UUID` is generated (`session_<uuid>`) and WebRTC protocols are spun up. 

## 4. WebRTC Signaling (The Call)
Inside the matching UI, the two browsers begin a P2P handshake using WebRTC. 
*   They exchange `SDP (Session Description Protocol)` offers via the Django ASGI WebSocket (`/room/consumers.py`).
*   They beam ICE Candidates through STUN servers to penetrate NAT barriers.
*   Once connected, the central server withdraws, and the users are experiencing extremely low-latency end-to-end encrypted video and audio chat.
