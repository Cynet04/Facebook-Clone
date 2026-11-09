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

## Phase 29+: Infinite
- [ ] E2E test scaffold
- [ ] Data export/import mock
- [ ] Developer/admin diagnostics panel
- [ ] Analytics/events stub
- [ ] ...continue indefinitely
