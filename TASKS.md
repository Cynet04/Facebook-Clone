# Facebook Clone — Development Tasks

## Phase 1: Layout
- [x] Express server + static frontend scaffold
- [x] JSON DB bootstrap (`data/db.json`)
- [x] Top blue navbar (logo/search/nav icons/profile)
- [x] Left sidebar (shortcuts/menu)
- [x] Middle news feed column
- [x] Right sidebar (contacts/sponsored placeholder)
- [x] Responsive base styles

## Phase 2: Authentication (Mock)
- [x] Login page/modal
- [x] Signup page/modal
- [x] Mock session via localStorage
- [x] Protected UI state (logged in/out)

## Phase 3: News Feed
- [x] Create post (text)
- [x] Display posts from DB (reverse chronological)
- [x] Like/unlike posts
- [x] Add/view comments
- [x] Persist to `data/db.json`

## Phase 4: Profiles
- [x] Profile page/route view
- [x] Cover photo area
- [x] Avatar + basic info
- [x] User timeline (user’s posts)

## Phase 5: Friends System
- [x] Friends list
- [x] Add friend / send request
- [x] Accept/decline requests
- [x] Friend status on profiles

## Phase 6: Messenger
- [x] Chat overlay UI
- [x] Conversations list
- [x] Send/receive messages (mock realtime via polling)
- [x] Persist messages

## Phase 7: Groups
- [x] Groups directory
- [x] Create/join group
- [x] Group feed/posts (MVP: create/join + group list; dedicated group feed next)

## Phase 8: Notifications
- [x] Notifications dropdown
- [x] Generate notifications (likes, comments, friend requests, messages)
- [x] Mark read/unread

## Phase 9: Dark Mode
- [x] Add dark theme CSS variables
- [x] Add theme toggle in navbar/account UI
- [x] Persist theme preference in localStorage
- [x] Apply theme on load and toggle events
- [x] Verify layout/readability in dark mode (code-level variable pass)

## Phase 10: Reactions
- [x] Add reaction picker (Like, Love, Haha, Wow, Sad, Angry)
- [x] Store per-user reaction on posts
- [x] Render reaction counts/summary
- [x] Backward compatibility with legacy likes

## Phase 11: Search & Stories MVP
- [x] Search: show grouped results count and preserve query
- [x] Search: add "no query" state and Enter hint polish
- [x] Stories: add stories data model/API (mock)
- [x] Stories: render stories rail on home feed
- [x] Stories: allow creating a text story

## Phase 12: Group Feed (Dedicated)
- [x] Add group posts API (list/create)
- [x] Add group detail/feed UI with member gate
- [x] Allow members to post in group feed
- [x] Show group posts in group view
- [x] Verify and commit

## Phase 13: Media URLs (Mock) & Post Enhancements
- [x] Allow optional image URL on posts
- [x] Render post images safely in feed/profile/search
- [x] Add image URL field in composer UI
- [x] Basic client/server validation for image URL
- [x] Verify and commit

## Phase 14: Marketplace Stub
- [x] Add marketplace data model/API (mock listings)
- [x] Add Marketplace view/navigation
- [x] Allow creating a listing (title, price, location, image URL)
- [x] Render listings grid/cards
- [x] Verify and commit

## Phase 15: Bookmarks / Saved Posts
- [x] Add saved posts data model/API per user
- [x] Add save/unsave action on posts
- [x] Add Saved view to list bookmarked posts
- [x] Persist saved state and render indicators
- [x] Verify and commit

## Phase 16: Settings & Privacy (Mock)
- [x] Add Settings view (profile basics, privacy toggles mock)
- [x] Persist mock settings in localStorage
- [x] Add "Who can see your posts" UI state (mock enforcement in UI labels)
- [x] Add account/session info panel
- [x] Verify and commit

## Phase 17: Feed Pagination (Mock Infinite Scroll)
- [x] Add paginated posts API (`limit`/`offset`)
- [x] Add "Load more" / scroll-triggered loading in feed
- [x] Preserve order and deduplicate loaded posts
- [x] Keep search/profile rendering compatible
- [x] Verify and commit

## Phase 18: Post Sharing / Repost (MVP)
- [x] Add repost/share data model on posts
- [x] Add Share action on post cards
- [x] Render shared post attribution/content
- [x] Prevent duplicate rapid shares (basic client guard)
- [x] Verify and commit

## Phase 19: Comment Replies & Comment Reactions (MVP)
- [x] Add comment reply data model (`parentId`)
- [x] Add comment reaction data/API (mock)
- [x] Render nested replies and reply composer
- [x] Render comment reaction buttons/counts
- [x] Verify and commit

## Phase 20: Post Editing & Deletion (MVP)
- [x] Add edit/delete post APIs with owner checks (mock)
- [x] Add post menu UI for owner actions
- [x] Support inline edit/save/cancel and delete confirm
- [x] Refresh feed/profile/search after mutations
- [x] Verify and commit

## Phase 21: Comment Edit/Delete (MVP)
- [x] Add edit/delete comment APIs with owner checks
- [x] Add owner actions on comments/replies
- [x] Support inline edit and delete (with child reply handling policy)
- [x] Refresh affected post comments after mutations
- [x] Verify and commit

## Phase 22: Admin/Moderation Stubs
- [x] Add admin/moderation view (mock, gated by local flag)
- [x] Add report-post/report-comment API stubs and UI actions
- [x] Add moderation queue display from JSON DB
- [x] Add mock resolve/dismiss actions
- [x] Verify and commit

## Phase 23: PWA / Offline Stub
- [x] Add web manifest and basic icons metadata (SVG/data stubs)
- [x] Add service worker for shell caching (network-first fallback)
- [x] Register service worker in frontend
- [x] Add offline status indicator in UI
- [x] Verify and commit

## Phase 24: Real-time Transport Mock Improvements
- [x] Add lightweight polling intervals for feed/messages/notifications visibility
- [x] Add "last updated" indicator and manual refresh control
- [x] Reduce unnecessary reloads by checking view/state guards
- [x] Add basic API error surface in UI status line
- [x] Verify and commit

## Phase 25: Accessibility Pass (MVP)
- [x] Add/verify ARIA labels, landmarks, and focus-visible styles
- [x] Improve keyboard navigation for menus, dialogs, and forms
- [x] Add skip link and better heading structure
- [x] Ensure color-contrast-safe status indicators in both themes
- [x] Verify and commit

## Phase 26: User Blocking & Reporting Expansion (Mock)
- [x] Add block/unblock user API and local state handling
- [x] Hide blocked users' posts/messages/contacts in UI (mock)
- [x] Add block action in profile/friends views
- [x] Expand report reasons/categories and blocked-user safeguards
- [x] Verify and commit

## Phase 27: Performance Polish (Mock-safe)
- [x] Debounce search input and avoid unnecessary renders
- [x] Cache DOM selectors and limit comment loading work
- [x] Add lightweight loading skeleton/placeholder states
- [x] Optimize polling/render guards for visible view only
- [x] Verify and commit

## Phase 28: i18n Stub (English/Spanish)
- [x] Add language selector in Settings
- [x] Persist language preference in localStorage
- [x] Add small translation map and apply to key UI labels/placeholders
- [x] Keep fallback/default English behavior
- [x] Verify and commit

## Phase 29: E2E Test Scaffold (Mock)
- [x] Add minimal E2E test runner script (Playwright/Puppeteer-free lightweight HTTP+DOM checks or Node fetch smoke)
- [x] Add API smoke tests for key endpoints (auth/posts/comments/groups/marketplace/reports)
- [x] Add frontend shell smoke checks (index contains key UI anchors)
- [x] Wire `npm run test:e2e` script
- [x] Verify and commit

## Phase 30: Data Export/Import Mock (JSON)
- [x] Add export endpoint/UI action to download DB snapshot (mock-safe fields)
- [x] Add import endpoint/UI action with validation/merge or replace option
- [x] Add basic safeguards (size/type checks, error messaging)
- [x] Add diagnostics panel entry showing DB counts
- [x] Verify and commit

## Phase 31: Developer/Admin Diagnostics Panel
- [x] Add diagnostics endpoint with expanded runtime info (counts, uptime, node version)
- [x] Add in-app diagnostics panel with refresh button
- [x] Show recent client errors/status in diagnostics (mock-safe)
- [x] Add moderator-gated access hint (reuse settings flag)
- [x] Verify and commit

## Phase 32: Analytics / Events Stub
- [x] Add client event helper and log key UI actions (post, like, comment, share, search)
- [x] Add server endpoint to accept mock analytics events
- [x] Persist events in JSON DB with basic trimming/limits
- [x] Surface event counts in diagnostics panel
- [x] Verify and commit

## Phase 33: Scheduled Posts (Mock)
- [x] Add scheduled post fields/API (`scheduledFor`, status) with mock scheduler check
- [x] Add schedule option in composer UI (datetime-local)
- [x] Show scheduled posts in a "Scheduled" section (owner-only mock view)
- [x] Publish due scheduled posts on load/poll (client-side mock trigger)
- [x] Verify and commit

## Phase 34: Scheduled Stories Mock
- [x] Add scheduled story fields/API (`scheduledFor`, status) with mock scheduler check
- [x] Add schedule option in story UI (datetime-local)
- [x] Show scheduled stories in owner-only section
- [x] Publish due scheduled stories on load/poll
- [x] Verify and commit

## Phase 35: Rate Limiting / Security Hardening (Mock)
- [x] Add simple in-memory rate limit middleware for auth/write endpoints
- [x] Add basic input sanitization/length limits and safe error responses
- [x] Add CORS/config hardening toggles (mock-safe defaults)
- [x] Surface rate-limit status in diagnostics/client errors
- [x] Verify and commit

## Phase 36: Post Pinning / Highlights
- [x] Add pinned/highlight flags on posts (owner-only)
- [x] Add pin/unpin and highlight actions in post menu
- [x] Render pinned posts at top of profile and optional feed badge
- [x] Persist flags via API
- [x] Verify and commit

## Phase 37: Profile / About Details Expansion
- [x] Add extended profile fields (work, education, location, relationship, website)
- [x] Add profile "About" section/tab UI
- [x] Add API support to read/update about fields (owner-only)
- [x] Show about info on profile and in settings/profile edit
- [x] Verify and commit

## Phase 38: Friend Suggestions Algorithm (Mock)
- [x] Add `/api/users/:id/suggestions` using mutual-friends heuristic
- [x] Rank suggestions by mutual count and exclude blocked/friends/pending/self
- [x] Update Friends/People UI to show mutual-friend counts and reasons
- [x] Track suggestion interactions (add friend/block) via analytics
- [x] Verify and commit

## Phase 39: Hashtags & Mentions (Stub)
- [x] Parse #hashtags and @mentions in post/comment rendering
- [x] Make hashtag/mention tokens clickable (search/profile navigation mock)
- [x] Add hashtag index in search results (simple client/server scan)
- [x] Track hashtag/mention interactions via analytics
- [x] Verify and commit

## Phase 40: Link Previews (Mock)
- [x] Detect first URL in post content
- [x] Render mock link preview card (domain/title placeholder/favicon-style)
- [x] Add URL safety checks for preview rendering
- [x] Cache preview metadata client-side in-memory/localStorage mock
- [x] Verify and commit

## Phase 41: Poll Posts (Mock)
- [x] Add poll data model/API support on posts (options, votes)
- [x] Add poll composer UI (question + 2-4 options)
- [x] Render poll in posts and allow single-choice voting
- [x] Persist votes per user and show percentages/counts
- [x] Verify and commit

## Phase 42: Watch / Videos Stub
- [x] Add `/api/videos` mock endpoints and `videos` collection seed
- [x] Add Watch view shell with video cards/player placeholder
- [x] Seed/sample videos and basic like/save mock interactions
- [x] Track watch interactions via analytics
- [x] Verify and commit

## Phase 43: Memories / On This Day (Stub)
- [x] Add client-side memories selector from historical posts/stories
- [x] Add Memories/On This Day card on home view
- [x] Add empty-state and date formatting
- [x] Track memory interactions via analytics
- [x] Verify and commit

## Phase 44: Events Stub
- [x] Add `/api/events` mock endpoints and `eventItems` data model (avoids analytics `events`)
- [x] Add Events nav/view shell with create + RSVP mock actions
- [x] Seed sample events and render upcoming events list
- [x] Track event interactions via analytics
- [x] Verify and commit

## Phase 45: Birthdays Stub
- [ ] Add birthday fields/helpers and mock upcoming birthdays list
- [ ] Add Birthdays view/card in sidebar/home
- [ ] Allow quick "wish" interaction (mock notification/analytics)
- [ ] Handle empty states
- [ ] Verify and commit

## Phase 46+: Infinite
- [ ] Fundraisers stub
- [ ] Pages stub
- [ ] Saved collections/folders
- [ ] Reels stub
- [ ] ...continue indefinitely
