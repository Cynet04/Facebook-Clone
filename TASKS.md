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
- [ ] Add reaction picker (Like, Love, Haha, Wow, Sad, Angry)
- [ ] Store per-user reaction on posts
- [ ] Render reaction counts/summary
- [ ] Backward compatibility with legacy likes

## Phase 11+: Infinite
- [ ] Search enhancements (highlight, recent searches)
- [ ] Media uploads (mock URLs)
- [ ] Stories
- [ ] Marketplace stub
- [ ] ...continue indefinitely
