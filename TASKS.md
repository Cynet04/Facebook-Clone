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

## Phase 12+: Infinite
- [ ] Group feed/posts (dedicated)
- [ ] Media uploads (mock URLs)
- [ ] Marketplace stub
- [ ] Privacy/settings mock
- [ ] ...continue indefinitely
