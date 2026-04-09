# 04 Primary Database Schema

Although parts of the application utilize secondary caching stores or SQLAlchemy for localized FastAPI endpoints, the root architecture uses Django's ORM mapped tightly to the standard built-in relational SQL.

## Core Models

### `users.Profile(models.Model)`
The primary workhorse table storing deep psychometric configuration attached to every `User`.
*   `user`: OneToOne relation bridging the default Django `auth.User`.
*   `interests`, `expertise_areas`: Native database JSON arrays of strings containing topics the user is highly linked to.
*   `interests_embedding`, `expertise_embedding`: Critical JSON tables housing the float structures calculated by `text-embedding-004`. Used heavily by `matchmaking/engine.py`.
*   `psychological_profile` & `self_reported_traits`: Extensive metrics mapped by FastAPI's Deep Profiler logic.
*   `trust_score`: The overarching metric ranging from 0-100 indicating if the user frequently blocks peers or routinely builds solid connections.

### `matchmaking.api.views.active_loop`
Currently utilizing temporary volatile queues (`Loop` model or `MatchHistory`) mapping users looking iteratively for live real-time matches before generating a WebRTC handshake. 

## Secondary Analytics Layers (Future Proofing)
As mentioned in the Engine notes, fields that map behavior analytics can iteratively feed into automated ML loops:
*   `MatchHistory` tracks `user1` and `user2` to ensure unique P2P connections are established. Re-matching the exact same user twice is blocked.
*   `MatchFeedback` modules (if enabled) capture telemetry mapping to the MatchEvaluator heuristics.

> [!WARNING]
> Do NOT alter standard Django migrations in standard SQL if modifying `JSONFields` that enforce strict Numpy dimensions. Backfilling large Vector fields across migrations demands iterative mapping!
