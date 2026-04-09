# 01 System Architecture

Glysmork is built on a split backend infrastructure with a single unifying Node.js frontend. The architecture is explicitly designed to handle heavy AI inference, real-time matchmaking loops, and WebRTC streaming.

## High-Level Topology

1. **Frontend**: Next.js (React)
2. **Real-time Core**: Django + Django Channels (ASGI)
3. **Onboarding Services**: FastAPI
4. **Primary Database**: SQLite (for dev) -> PostgreSQL mapped
5. **Memory Store / Brokers**: Redis
6. **Task Queues**: Celery

## Directory Structure
- `/frontend/`: The Next.js React application.
- `/chat/`: The core Django ASGI settings module and global routing.
- `/users/`: Django app managing User Profiles, tracking flags, and global vectors.
- `/matchmaking/`: Django app containing the Hybrid AST Matrix and Loop algorithms.
- `/onboarding_service/`: Standalone FastAPI application strictly handling the deep psychometric user induction.
- `/room/` & `/calls/`: Django apps handling WebRTC signaling sequences and real-time chat layers.

## The FastAPI / Django Split
Why two backends?
*   **FastAPI `onboarding_service`**: Highly optimized for burst-heavy asynchronous IO (like calling LLMs iteratively to determine traits while a user takes a personality quiz). It does not maintain stateful WebSockets.
*   **Django Core**: Built around `daphne` and `channels_redis`, it maintains persistent WebSocket connections for thousands of concurrent users in the `Loop`. It natively understands the WebRTC signaling handshake.

## Vector Embedding System
Glysmork uses `numpy` for blazing fast localized dimensionality reduction calculations over the `<Profile>` database. When a user is onboarded, their freeform text arrays (`interests`, `expertise`) are piped through Gemini's `text-embedding-004` to produce a 768-D vector mapping. This mapping is securely stored in standard `JSONFields` on the Django models instead of a dedicated Vector Database, drastically reducing cloud operational costs up to ~50,000 MAU.
