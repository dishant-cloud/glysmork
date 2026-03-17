# Comprehensive Feature Enhancements Implementation Plan

This plan outlines the technical changes required to fulfill the requested feature updates across the onboarding, matchmaking, and analytics services.

## User Review Required
> [!WARNING]
> This is a large-scale update touching multiple core components.
> **Please review the "Live vs Offline Matchmaking" architecture below to ensure the implementation precisely matches your vision before we proceed.**

## Proposed Changes

### Phase 1: Onboarding & Questionnaire Pruning
We will remove the mandatory questions about communication preference and availability from the AI conversation.

#### [MODIFY] [onboarding_service/llm.py](file:///d:/myworks/glysmork0/onboarding_service/llm.py)
- **`get_chat_response`**: Remove `communication preference (text / voice / video)` and `availability and frequency` from the universal basics list in the `system_prompt`.
- **`extract_structured_data`**: Remove `availability` and `communication_preference` from the `hard_filters` JSON schema definition to stop the LLM from hallucinating them.

---

### Phase 2: "Talk to Someone" Personas
We will allow users to choose different AI personas for emotional support.

#### [MODIFY] [matchmaking/api/views.py](file:///d:/myworks/glysmork0/matchmaking/api/views.py)
- **`SupportChatView`**: Update to accept a `persona` parameter from the frontend.
- Create a dictionary of `PERSONAS` (e.g., "Empathetic Listener", "Tough Love", "Analytical Advisor", "Warm Companion"). Inject the selected persona into the `SYSTEM_PERSONA` instructions.

#### [MODIFY] [frontend/src/app/dashboard/page.tsx](file:///d:/myworks/glysmork0/frontend/src/app/dashboard/page.tsx)
- Update the "04. Talk to Someone" card to open a preliminary selection modal to choose the Persona before initiating the chat.
- Pass the selected persona to the `/matchmaking/support-chat/` endpoint.

---

### Phase 3: Site Analytics Dashboard
We will build a new analytics dashboard for users to view network statistics.

#### [NEW] [users/api/views.py](file:///d:/myworks/glysmork0/users/api/views.py) (Add Endpoint)
- Create `AnalyticsView` returning:
  - Total active users (online now).
  - Categorization counts (based on `current_intent` or recently active buckets).
  - Gender and Location breakdowns.
  - Time-series data representing user joins over the past 7 days.

#### [NEW] [frontend/src/app/analytics/page.tsx](file:///d:/myworks/glysmork0/frontend/src/app/analytics/page.tsx)
- Create a new frontend page accessible from the sidebar.
- Fetch data from `AnalyticsView` and render it using charts/metrics counters.

---

### Phase 4: Matchmaking Core & Modes (Live vs Offline, No Repeats)
This is the most significant architectural change. We need to distinguish between active matching and background matching, and prevent re-matching.

#### [NEW] [matchmaking/models.py](file:///d:/myworks/glysmork0/matchmaking/models.py)
- **`MatchHistory` Model**: To log every time User A and User B interact in a room. 
  - Fields: `user1`, `user2`, `timestamp`.
  - Used to filter out users who have previously matched together.
- **`OfflineSearch` Model**: To track active offline searches.
  - Fields: `user`, `intent`, `mode` (Text/Video), `gender_filter`, `location_filter`, `daily_refresh_timestamp`, `matches_found` (Count integer, max 4), `is_active` (boolean).

#### [MODIFY] [matchmaking/api/views.py](file:///d:/myworks/glysmork0/matchmaking/api/views.py)
- **`JoinMatchmakingView`**:
  - Update `attempt_discovery` and random matching filters to **exclude users found in `MatchHistory`**.
  - Accept new parameters from frontend: `is_offline`, `mode` (Text/Video toggle), `gender_filter`, `location_filter`.
  - **Live Matching**: Execute normal logic, but filter based on the new explicit criteria.
  - **Offline Matching**: If `is_offline` is true:
    1. Create/update an `OfflineSearch` row for the user.
    2. Respond with "Offline search activated. Check back daily."
- **New Task/Endpoint (`OfflineMatchEngine`)**:
  - A background process or CRON endpoint that scans active `OfflineSearch` models where `matches_found < 4` and `daily_refresh_timestamp` is within the last 24 hours.
  - When it finds a match, it sends a `ChatNotification` to the user.

#### [MODIFY] [frontend/src/app/dashboard/page.tsx](file:///d:/myworks/glysmork0/frontend/src/app/dashboard/page.tsx)
- Redesign the Matchmaking UI controls:
  - Add explicit global toggles for **Live vs Offline**.
  - Add global setting filters for **Text vs Video**.
  - Add manual filter dropdowns for **Gender** and **Location**.
- **Roulette Restriction**: Disable the Roulette card entirely if the user has toggled "Offline". Roulette will strictly be Live.
- **Offline Refresh Button**: Add a "Keep Searching" button visible to users who have an active offline search, updating their 24-hour activity window.

---

### Phase 5: Profile Photo Functionality
We will implement user profile photo uploads.

#### [MODIFY] [users/models.py](file:///d:/myworks/glysmork0/users/models.py)
- **`Profile` Model**: Add `profile_photo` as an `ImageField` (requires `Pillow`).

#### [NEW] [users/api/views.py](file:///d:/myworks/glysmork0/users/api/views.py) (Add Upload Endpoint)
- Create `ProfilePhotoUploadView` to handle multipart/form-data image uploads.
- Ensure the image is saved to the `profile_pics` directory and the path is linked to the user's profile.

#### [MODIFY] [frontend/src/app/profile/page.tsx](file:///d:/myworks/glysmork0/frontend/src/app/profile/page.tsx)
- Add a photo upload component.
- Display the current profile image with a fallback to the first letter avatar.

---

### Phase 6: Verification

### Automated Tests
- N/A

### Manual Verification
1. Run a new user through Onboarding to verify the AI does not ask about availability or communication medium.
2. Select a new Persona in "Talk to someone" and verify the AI's tone changes accordingly.
3. Access the Analytics page and confirm accurate metrics based on the database state.
4. Set up an Offline Search, artificially trigger the background engine, and verify the user receives exactly 4 match notifications and no more.
5. Verify that matching the same two simulated users twice is impossible.
6. Upload a profile photo and verify it persists across sessions and is visible to matching partners.
