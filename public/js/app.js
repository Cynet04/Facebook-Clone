(() => {
  const state = {
    user: JSON.parse(localStorage.getItem('fb_user') || 'null'),
    token: localStorage.getItem('fb_token') || '',
    theme: localStorage.getItem('fb_theme') || 'light',
    settings: JSON.parse(localStorage.getItem('fb_settings') || '{"audience":"public","showEmail":false,"allowRequests":true,"storySharing":true,"isModerator":false,"lang":"en"}'),
    users: [],
    posts: [],
    postsOffset: 0,
    postsLimit: 10,
    postsTotal: 0,
    postsLoading: false,
    stories: [],
    marketplace: [],
    reports: [],
    notifications: [],
    groups: [],
    groupPosts: [],
    activeGroupId: null,
    conversations: [],
    messages: [],
    activeChatUserId: null,
    commentsByPost: {},
    view: 'home',
    profileUserId: null,
    searchQuery: '',
    lastUpdatedAt: null,
    lastError: '',
    searchTimer: null
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = (name) => (name || 'U').trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||'').join('') || 'U';
  const timeAgo = (iso) => {
    if (!iso) return '';
    const d = new Date(iso); const s = Math.floor((Date.now()-d.getTime())/1000);
    if (s < 60) return 'Just now'; const m = Math.floor(s/60); if (m<60) return `${m}m`; const h=Math.floor(m/60); if (h<24) return `${h}h`; const days=Math.floor(h/24); return `${days}d`;
  };

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem('fb_theme', state.theme);
    const btn = $('#themeBtn');
    if (btn) btn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
    const menuBtn = $('#themeMenuBtn');
    if (menuBtn) menuBtn.textContent = state.theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  }
  function toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); }

  async function api(path, opts = {}) {
    try {
      const res = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) }, ...opts });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      state.lastError = '';
      return data;
    } catch (e) {
      state.lastError = e.message || 'Network error';
      renderStatus();
      throw e;
    }
  }
  function renderStatus() {
    const el = $('#statusLine'); if (!el) return;
    const t = state.lastUpdatedAt ? new Date(state.lastUpdatedAt).toLocaleTimeString() : 'never';
    el.textContent = state.lastError ? `Error: ${state.lastError}` : `Updated ${t}`;
    el.classList.toggle('status-error', !!state.lastError);
  }

  function setSession(user, token) {
    state.user = user; state.token = token;
    if (user) localStorage.setItem('fb_user', JSON.stringify(user)); else localStorage.removeItem('fb_user');
    if (token) localStorage.setItem('fb_token', token); else localStorage.removeItem('fb_token');
  $('#themeBtn')?.addEventListener('click', toggleTheme);
  $('#themeMenuBtn')?.addEventListener('click', () => { toggleTheme(); $('#accountMenu').classList.add('hidden'); });

  $('#storyForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get('text');
    if (!String(text||'').trim()) return;
    await api('/api/stories', { method:'POST', body: JSON.stringify({ userId: state.user.id, text, bg: 'linear-gradient(135deg,#1877f2,#42b72a)' }) }).catch(err=>alert(err.message));
    e.target.reset(); await loadAux(); renderStories();
  });

  renderAuth();
  applyTheme();
  }

  function refreshSessionUser() {
    if (!state.user) return;
    const fresh = state.users.find(u => u.id === state.user.id);
    if (fresh) setSession({ ...state.user, ...fresh }, state.token);
  }

  function renderAuth() {
    const authed = !!state.user;
    $('#authGate').classList.toggle('hidden', authed);
    $('#mainView').classList.toggle('hidden', !authed);
    $('#composerCard')?.classList.toggle('hidden', !authed);
    $('#accountInfo').textContent = authed ? `${state.user.name} (${state.user.email})` : '';
    const name = state.user?.name || 'User';
    const ini = initials(name);
    $('#navAvatar').textContent = ini;
    $('#sideAvatar').textContent = ini;
    if ($('#composerAvatar')) $('#composerAvatar').textContent = ini;
    $('#sideName').textContent = name;
    renderView();
  }

  function renderView() {
    if (!state.user) return;
    ['home','profile','friends','groups','messenger','search','marketplace','saved','settings','moderation'].forEach(v => $(`#${v}View`)?.classList.toggle('hidden', state.view !== v));
    $$('.nav-icon').forEach(el => el.classList.toggle('active', el.dataset.view === state.view));
    if (state.view === 'profile') renderProfile();
    if (state.view === 'home') renderPosts();
    if (state.view === 'friends') renderFriends();
    if (state.view === 'groups') renderGroups();
    if (state.view === 'messenger') renderMessengerPage();
    if (state.view === 'marketplace') renderMarketplace();
    if (state.view === 'saved') renderSaved();
    if (state.view === 'settings') renderSettings();
    if (state.view === 'moderation') renderModeration();
    if (state.view === 'search') renderSearch();
  }

  function userById(id) { return state.users.find(u => u.id === id) || { name: 'Unknown User', id }; }
  function blockedIds() { return new Set(userById(state.user?.id).blockedUsers || []); }
  function isBlockedEither(a, b) { const A = userById(a), B = userById(b); return (A.blockedUsers||[]).includes(b) || (B.blockedUsers||[]).includes(a); }
  function visiblePosts() { const b = blockedIds(); return state.posts.filter(p => !b.has(p.userId) && !(p.sharedFrom && b.has(p.sharedFrom.userId))); }

  function reactionMeta(key) {
    return ({ like:['👍','Like','liked'], love:['❤️','Love','loved'], haha:['😆','Haha','reacted-haha'], wow:['😮','Wow','reacted-wow'], sad:['😢','Sad','reacted-sad'], angry:['😠','Angry','reacted-angry'] })[key] || ['👍','Like','liked'];
  }
  function reactionSummary(post) {
    const counts = {};
    Object.values(post.reactions || {}).forEach(r => counts[r] = (counts[r]||0)+1);
    if (!Object.keys(counts).length && (post.likes||[]).length) counts.like = post.likes.length;
    const parts = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `${reactionMeta(k)[0]} ${v}`);
    return parts.join(' · ') || '0 reactions';
  }

  function commentTree(comments) {
    const byId = {}; comments.forEach(c => byId[c.id] = { ...c, children: [] });
    const roots = [];
    comments.forEach(c => { if (c.parentId && byId[c.parentId]) byId[c.parentId].children.push(byId[c.id]); else roots.push(byId[c.id]); });
    return roots;
  }
  function commentReactionLabel(c) {
    const counts = {}; Object.values(c.reactions || {}).forEach(r => counts[r] = (counts[r]||0)+1);
    const total = Object.values(counts).reduce((a,b)=>a+b,0) || (c.likes||[]).length;
    if (!total) return '';
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    return `${top ? reactionMeta(top[0])[0] : '👍'} ${total}`;
  }
  function renderComment(c, postId, depth=0) {
    const my = c.reactions?.[state.user?.id];
    const children = (c.children||[]).map(ch => renderComment(ch, postId, depth+1)).join('');
    const mine = c.userId === state.user?.id;
    return `<div class="comment-block" style="margin-left:${Math.min(depth,3)*14}px" data-comment-id="${esc(c.id)}">
      <div class="comment" id="comment-body-${esc(c.id)}"><strong>${esc(userById(c.userId).name)}</strong><span>${esc(c.content)}</span>${c.editedAt ? ' <span class="muted">(edited)</span>' : ''}</div>
      <form class="comment-form comment-edit hidden" id="comment-edit-${esc(c.id)}" data-edit-comment-form="${esc(c.id)}"><input name="content" maxlength="1000" value="${esc(c.content)}" /><button class="btn small primary" type="submit">Save</button><button class="btn small" type="button" data-cancel-edit-comment="${esc(c.id)}">Cancel</button></form>
      <div class="comment-actions">
        ${['like','love','haha'].map(r=>`<button class="linkish ${my===r?'active':''}" data-react-comment="${esc(c.id)}" data-reaction="${r}">${reactionMeta(r)[0]}</button>`).join('')}
        <span class="muted">${esc(commentReactionLabel(c))}</span>
        <button class="linkish" data-reply-comment="${esc(c.id)}" data-post-id="${esc(postId)}">Reply</button>
        ${mine ? `<button class="linkish" data-edit-comment="${esc(c.id)}">Edit</button><button class="linkish danger" data-delete-comment="${esc(c.id)}">Delete</button>` : `<button class="linkish" data-report-comment="${esc(c.id)}">Report</button>`}
      </div>
      <form class="comment-form reply-form hidden" data-comment-form="${esc(postId)}" data-parent-id="${esc(c.id)}"><input name="content" placeholder="Write a reply..." maxlength="500" /></form>
      ${children}
    </div>`;
  }

  function postCard(p) {
    const u = userById(p.userId);
    const myReaction = p.reactions?.[state.user?.id] || ((p.likes || []).includes(state.user?.id) ? 'like' : null);
    const comments = (state.commentsByPost?.[p.id] || []);
    const saved = (userById(state.user?.id).savedPosts || []).includes(p.id);
    const [icon,label,cls] = reactionMeta(myReaction || 'like');
    return `
      <article class="card post" data-post-id="${esc(p.id)}">
        <div class="post-head">
          <span class="avatar-sm">${esc(initials(u.name))}</span>
          <div>
            <div class="post-author"><a href="#" data-open-profile="${esc(u.id)}">${esc(u.name)}</a></div>
            <div class="post-time">${esc(timeAgo(p.createdAt))}${p.editedAt ? ' · Edited' : ''}</div>
          </div>
          ${p.userId === state.user?.id ? `<div class="post-menu-wrap"><button class="icon-btn small-ghost" data-post-menu="${esc(p.id)}">⋯</button><div class="post-menu hidden" id="post-menu-${esc(p.id)}"><button data-edit-post="${esc(p.id)}">Edit</button><button data-delete-post="${esc(p.id)}">Delete</button></div></div>` : ''}
        </div>
        ${p.sharedFrom ? `<div class="shared-note muted">Shared from <a href="#" data-open-profile="${esc(p.sharedFrom.userId)}">${esc(userById(p.sharedFrom.userId).name)}</a></div>` : ''}
        <div class="post-body" id="post-body-${esc(p.id)}">${esc(p.content)}</div>
        <form class="post-edit hidden stack" id="post-edit-${esc(p.id)}" data-edit-form="${esc(p.id)}"><textarea name="content" maxlength="5000">${esc(p.content)}</textarea><div class="row gap"><button class="btn primary small" type="submit">Save</button><button class="btn small" type="button" data-cancel-edit-post="${esc(p.id)}">Cancel</button></div></form>
        ${p.imageUrl ? `<img class="post-image" src="${esc(p.imageUrl)}" alt="Post image" loading="lazy" />` : ''}
        <div class="post-stats"><span>${esc(reactionSummary(p))}</span><span>${comments.length} comments · ${p.shares||0} shares</span></div>
        <div class="post-actions">
          <div class="react-wrap">
            <button data-react="${esc(p.id)}" data-reaction="${myReaction || 'like'}" class="react-main ${myReaction ? cls : ''}">${myReaction ? icon : '👍'} ${myReaction ? label : 'Like'}</button>
            <div class="react-picker">
              ${['like','love','haha','wow','sad','angry'].map(r=>`<button data-react="${esc(p.id)}" data-reaction="${r}" title="${reactionMeta(r)[1]}">${reactionMeta(r)[0]}</button>`).join('')}
            </div>
          </div>
          <button data-focus-comment="${esc(p.id)}">💬 Comment</button>
          <button data-share-post="${esc(p.id)}">↗️ Share</button>
          <button data-save-post="${esc(p.id)}" class="${saved?'saved':''}">${saved?'🔖 Saved':'🔖 Save'}</button>
          <button data-report-post="${esc(p.id)}">🚩 Report</button>
        </div>
        <div class="comments">
          ${commentTree(comments).map(c => renderComment(c, p.id)).join('')}
          <form class="comment-form" data-comment-form="${esc(p.id)}">
            <input name="content" placeholder="Write a comment..." maxlength="500" />
          </form>
        </div>
      </article>`;
  }

  function saveSettings(s) { state.settings = { ...state.settings, ...s }; localStorage.setItem('fb_settings', JSON.stringify(state.settings)); }
  function audienceLabel(v) { return ({ public:'Public', friends:'Friends', only_me:'Only me' })[v] || 'Public'; }
  function trackEvent(type, meta = {}) {
    if (!type) return;
    fetch('/api/analytics/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type, userId: state.user?.id || null, meta }) }).catch(()=>{});
  }
  async function renderDiagnostics() {
    const gate = !state.settings.isModerator ? ' (enable moderator flag in settings for full mock access context)' : '';
    try {
      const [d, a] = await Promise.all([api('/api/admin/diagnostics'), api('/api/analytics/summary').catch(()=>({total:0,byType:{}}))]);
      const top = Object.entries(a.byType||{}).sort((x,y)=>y[1]-x[1]).slice(0,5).map(([k,v])=>`${k}=${v}`).join(' · ') || 'none';
      $('#diagnosticsPanel').innerHTML = `<strong>Server${gate}:</strong> up ${esc(d.uptimeSec)}s · node ${esc(d.node)} · ${Object.entries(d.counts||{}).map(([k,v])=>`${k}=${v}`).join(' · ')}<br/><strong>Events:</strong> ${esc(a.total||0)} (${esc(top)})`;
    } catch { $('#diagnosticsPanel').textContent = 'Diagnostics unavailable.'; }
    $('#clientDiagnostics').textContent = `Client: view=${state.view} · posts=${state.posts.length}/${state.postsTotal||0} · last=${state.lastUpdatedAt ? new Date(state.lastUpdatedAt).toLocaleTimeString() : 'never'} · error=${state.lastError || 'none'}`;
  }
  function renderSettings() {
    const f = $('#settingsForm'); if (!f) return;
    f.audience.value = state.settings.audience || 'public';
    f.showEmail.checked = !!state.settings.showEmail;
    f.allowRequests.checked = state.settings.allowRequests !== false;
    f.storySharing.checked = state.settings.storySharing !== false;
    $('#sessionInfo').innerHTML = state.user ? `<div><strong>${esc(state.user.name)}</strong></div><div class="muted">${esc(state.user.email)}</div><div class="muted">Theme: ${esc(state.theme)}</div><div class="muted">Audience label: ${esc(audienceLabel(state.settings.audience))}</div>` : '<div class="muted">Not signed in.</div>';
  }

  function renderStories() {
    const rail = $('#storiesRail');
    if (!rail) return;
    const mineFirst = [...state.stories].sort((a,b)=> (a.userId===state.user.id?-1:0) - (b.userId===state.user.id?-1:0));
    rail.innerHTML = mineFirst.length ? mineFirst.map(s => {
      const u = userById(s.userId);
      return `<div class="story" style="background:${esc(s.bg || 'linear-gradient(135deg,#1877f2,#42b72a)')}"><div class="story-user">${esc(u.name)}</div><div class="story-text">${esc(s.text)}</div></div>`;
    }).join('') : '<div class="muted">No stories in the last 24 hours.</div>';
  }

  function renderPosts() {
    renderStories();
    const container = $('#postsContainer');
    const posts = visiblePosts();
    if (!posts.length) {
      container.innerHTML = `<div class="card muted">No posts to show.</div>`;
      return;
    }
    const hasMore = state.posts.length < (state.postsTotal || state.posts.length);
    container.innerHTML = posts.map(p => postCard(p)).join('') + `
      <div class="card row" style="justify-content:center">
        ${hasMore ? `<button id="loadMorePosts" class="btn">${state.postsLoading ? 'Loading...' : 'Load more posts'}</button>` : `<span class="muted">No more posts</span>`}
      </div>`;
  }

  function renderProfile() {
    const id = state.profileUserId || state.user.id;
    const u = userById(id);
    const me = state.user;
    const isMe = u.id === me.id;
    const blockedByMe = (userById(me.id).blockedUsers || []).includes(u.id);
    $('#profileName').textContent = u.name || 'User';
    $('#profileAvatar').textContent = initials(u.name);
    $('#profileBio').textContent = u.bio || '';
    $('#profileSub').textContent = `${(u.friends||[]).length} friends${state.settings.showEmail && u.email ? ` · ${u.email}` : ''} · ${audienceLabel(state.settings.audience)}`;
    if (u.cover) $('#profileCover').style.background = u.cover;
    const reqSent = (u.friendRequests || []).includes(me.id);
    const reqIncoming = (me.friendRequests || []).includes(u.id);
    const isFriend = (me.friends || []).includes(u.id);
    let actions = '';
    if (isMe) actions = `<button class="btn small" id="toggleEditProfile">Edit Profile</button>`;
    else if (isBlockedEither(me.id, u.id)) actions = `<span class="pill">${blockedByMe ? 'Blocked' : 'Unavailable'}</span>${blockedByMe ? `<button class="btn small" data-block-user="${esc(u.id)}">Unblock</button>`:''}`;
    else if (isFriend) actions = `<span class="pill">Friends</span><button class="btn small" data-message-user="${esc(u.id)}">Message</button><button class="btn small" data-block-user="${esc(u.id)}">Block</button>`;
    else if (reqIncoming) actions = `<button class="btn primary small" data-respond-friend="${esc(u.id)}" data-accept="1">Confirm</button><button class="btn small" data-respond-friend="${esc(u.id)}" data-accept="0">Delete</button><button class="btn small" data-block-user="${esc(u.id)}">Block</button>`;
    else if (reqSent) actions = `<span class="pill">Request sent</span><button class="btn small" data-block-user="${esc(u.id)}">Block</button>`;
    else actions = `<button class="btn primary small" data-add-friend="${esc(u.id)}">Add Friend</button><button class="btn small" data-message-user="${esc(u.id)}">Message</button><button class="btn small" data-block-user="${esc(u.id)}">Block</button>`;
    $('#profileActions').innerHTML = actions;
    $('#profileEditCard').classList.toggle('hidden', !(isMe && state._editingProfile));
    if (isMe) {
      const f = $('#profileEditForm');
      f.name.value = u.name || ''; f.bio.value = u.bio || ''; f.cover.value = u.cover || '';
    }
    const mine = visiblePosts().filter(p => p.userId === id);
    $('#profilePosts').innerHTML = mine.length ? mine.map(p => postCard(p)).join('') : `<div class="card muted">No posts on this timeline yet.</div>`;
  }

  function renderContactsInto(sel) {
    const b = blockedIds();
    const list = state.users.filter(u => u.id !== state.user?.id && !b.has(u.id));
    const html = list.map(u => `<div class="contact menu-item" data-open-profile="${esc(u.id)}"><span class="avatar-sm">${esc(initials(u.name))}</span><span>${esc(u.name)}</span></div>`).join('') || '<div class="muted">No contacts.</div>';
    const el = $(sel); if (el) el.innerHTML = html;
  }

  function renderFriends() {
    const me = userById(state.user.id);
    const b = blockedIds();
    const reqs = (me.friendRequests || []).filter(id => !b.has(id)).map(id => userById(id));
    $('#friendRequests').innerHTML = reqs.length ? reqs.map(u => `<div class="list-row"><span class="row gap"><span class="avatar-sm">${esc(initials(u.name))}</span><strong>${esc(u.name)}</strong></span><span class="row gap"><button class="btn primary small" data-respond-friend="${esc(u.id)}" data-accept="1">Confirm</button><button class="btn small" data-respond-friend="${esc(u.id)}" data-accept="0">Delete</button></span></div>`).join('') : '<div class="muted">No friend requests.</div>';
    const people = state.users.filter(u => u.id !== me.id && !b.has(u.id) && !(me.friends||[]).includes(u.id) && !(me.friendRequests||[]).includes(u.id));
    $('#peopleList').innerHTML = people.length ? people.map(u => `<div class="list-row"><a href="#" data-open-profile="${esc(u.id)}" class="row gap"><span class="avatar-sm">${esc(initials(u.name))}</span><span>${esc(u.name)}</span></a><span class="row gap"><button class="btn primary small" data-add-friend="${esc(u.id)}">Add Friend</button><button class="btn small" data-block-user="${esc(u.id)}">Block</button></span></div>`).join('') : '<div class="muted">No suggestions.</div>';
    const friends = (me.friends || []).filter(id => !b.has(id)).map(id => userById(id));
    $('#friendsList').innerHTML = friends.length ? friends.map(u => `<div class="list-row"><a href="#" data-open-profile="${esc(u.id)}" class="row gap"><span class="avatar-sm">${esc(initials(u.name))}</span><span>${esc(u.name)}</span></a><span class="row gap"><button class="btn small" data-message-user="${esc(u.id)}">Message</button><button class="btn small" data-block-user="${esc(u.id)}">Block</button></span></div>`).join('') : '<div class="muted">No friends yet.</div>';
  }

  async function loadGroupPosts() {
    if (!state.activeGroupId) { state.groupPosts = []; return; }
    try { state.groupPosts = await api(`/api/groups/${state.activeGroupId}/posts`); } catch { state.groupPosts = []; }
  }
  function renderGroupDetail() {
    const card = $('#groupDetailCard');
    const g = state.groups.find(x => x.id === state.activeGroupId);
    if (!card) return;
    if (!g) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const member = (g.members || []).includes(state.user.id);
    $('#groupDetailTitle').textContent = g.name;
    $('#groupDetailMeta').textContent = `${(g.members||[]).length} members`;
    $('#groupPostForm').classList.toggle('hidden', !member);
    $('#groupGateMsg').textContent = member ? '' : 'Join this group to view/post in its feed (posting restricted).';
    $('#groupPosts').innerHTML = state.groupPosts.length
      ? state.groupPosts.map(p => `<div class="card subtle"><div class="post-head"><span class="avatar-sm">${esc(initials(userById(p.userId).name))}</span><div><div class="post-author">${esc(userById(p.userId).name)}</div><div class="post-time">${esc(timeAgo(p.createdAt))}</div></div></div><div class="post-body">${esc(p.content)}</div></div>`).join('')
      : `<div class="muted">${member ? 'No group posts yet.' : 'Group posts are visible to members in this MVP view after joining.'}</div>`;
  }

  function renderGroups() {
    $('#groupsList').innerHTML = state.groups.length ? state.groups.map(g => {
      const joined = (g.members||[]).includes(state.user.id);
      const active = g.id === state.activeGroupId ? ' active-row' : '';
      return `<div class="list-row${active}"><a href="#" data-open-group="${esc(g.id)}"><strong>${esc(g.name)}</strong> <span class="muted">· ${(g.members||[]).length} members</span></a><button class="btn small ${joined?'':'primary'}" data-join-group="${esc(g.id)}">${joined?'Joined':'Join'}</button></div>`;
    }).join('') : '<div class="muted">No groups yet.</div>';
    renderGroupDetail();
  }

  function notifText(n) {
    const actor = userById(n.actorId).name;
    if (n.type === 'like' || n.type === 'reaction') return `${actor} reacted to your post${n.reaction ? ` (${n.reaction})` : ''}.`;
    if (n.type === 'comment' || n.type === 'reply') return n.type === 'reply' ? `${actor} replied to your comment.` : `${actor} commented on your post.`;
    if (n.type === 'share') return `${actor} shared your post.`;
    if (n.type === 'friend_request') return `${actor} sent you a friend request.`;
    if (n.type === 'message') return `${actor} sent you a message.`;
    return 'New notification';
  }
  function renderNotifications() {
    const mine = state.notifications.filter(n => n.userId === state.user.id);
    const unread = mine.filter(n => !n.read).length;
    const badge = $('#notifBadge');
    badge.textContent = String(unread);
    badge.classList.toggle('hidden', unread === 0);
    $('#notifList').innerHTML = mine.length ? mine.slice(0,30).map(n => `<div class="notif ${n.read?'':'unread'}"><div>${esc(notifText(n))}</div><div class="muted post-time">${esc(timeAgo(n.createdAt))}</div></div>`).join('') : '<div class="muted">No notifications yet.</div>';
  }

  function threadUsers() {
    return state.users.filter(u => u.id !== state.user.id);
  }
  function messagesWith(uid) {
    return state.messages.filter(m => (m.fromId === state.user.id && m.toId === uid) || (m.fromId === uid && m.toId === state.user.id)).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  }
  function renderMessengerPane(containerSel, compact=false) {
    const b = blockedIds();
    const users = threadUsers().filter(u => !b.has(u.id));
    const active = state.activeChatUserId && users.some(u=>u.id===state.activeChatUserId) ? state.activeChatUserId : users[0]?.id || null;
    state.activeChatUserId = active;
    const el = $(containerSel);
    if (!el) return;
    if (!active) { el.innerHTML = '<div class="muted">No contacts available.</div>'; return; }
    const thread = messagesWith(active);
    el.innerHTML = `
      <div class="messenger ${compact?'compact':''}">
        <div class="messenger-list">${users.map(u=>`<button class="thread ${u.id===active?'active':''}" data-chat-user="${esc(u.id)}"><span class="avatar-sm">${esc(initials(u.name))}</span><span>${esc(u.name)}</span></button>`).join('')}</div>
        <div class="messenger-thread">
          <div class="thread-head"><strong>${esc(userById(active).name)}</strong></div>
          <div class="thread-msgs">${thread.map(m=>`<div class="bubble ${m.fromId===state.user.id?'me':'them'}">${esc(m.content)}</div>`).join('') || '<div class="muted">No messages yet.</div>'}</div>
          <form class="thread-send" data-send-chat="${esc(active)}"><input name="content" placeholder="Write a message..." autocomplete="off" /><button class="btn primary small">Send</button></form>
        </div>
      </div>`;
  }
  function renderMessengerOverlay() {
    $('#messengerOverlayBody').innerHTML = '<div id="messengerOverlayInner"></div>';
    renderMessengerPane('#messengerOverlayInner', true);
  }
  function renderMessengerPage() { renderMessengerPane('#messengerPage', false); }

  function renderMarketplace() {
    const el = $('#marketplaceList');
    if (!el) return;
    el.innerHTML = state.marketplace.length ? state.marketplace.map(m => `
      <div class="market-card">
        ${m.imageUrl ? `<img src="${esc(m.imageUrl)}" alt="${esc(m.title)}" loading="lazy" />` : `<div class="market-placeholder">No image</div>`}
        <div class="market-body">
          <div class="market-price">$${esc(m.price)}</div>
          <div class="market-title">${esc(m.title)}</div>
          <div class="muted">${esc(m.location || 'No location')} · ${esc(userById(m.userId).name)}</div>
        </div>
      </div>`).join('') : '<div class="muted">No listings yet.</div>';
  }

  function renderSaved() {
    const el = $('#savedPosts');
    if (!el) return;
    const ids = userById(state.user.id).savedPosts || [];
    const posts = ids.map(id => state.posts.find(p => p.id === id)).filter(Boolean);
    el.innerHTML = posts.length ? posts.map(p => postCard(p)).join('') : '<div class="muted">No saved posts yet. Use Save on any post.</div>';
  }

  function renderSearch() {
    const q = state.searchQuery.toLowerCase().trim();
    const meta = $('#searchMeta');
    if (!q) { meta.textContent = 'Type in the top search box and press Enter.'; $('#searchResults').innerHTML = ''; return; }
    const b = blockedIds();
    const users = state.users.filter(u => !b.has(u.id) && (u.name||'').toLowerCase().includes(q));
    const posts = visiblePosts().filter(p => (p.content||'').toLowerCase().includes(q));
    meta.textContent = `Query: "${state.searchQuery}" · ${users.length} people · ${posts.length} posts`;
    $('#searchResults').innerHTML = `
      <div class="section-title">People</div>
      ${users.map(u=>`<div class="list-row"><a href="#" data-open-profile="${esc(u.id)}">${esc(u.name)}</a></div>`).join('') || '<div class="muted">No people found.</div>'}
      <div class="section-title">Posts</div>
      ${posts.map(p=>postCard(p)).join('') || '<div class="muted">No posts found.</div>'}
    `;
  }

  async function loadUsers() { state.users = await api('/api/users'); renderContactsInto('#contactsList'); }
  async function loadCommentsForPosts() {
    state.commentsByPost = {};
    const targetIds = new Set(visiblePosts().slice(0, 15).map(p => p.id));
    if (state.view === 'profile') state.posts.filter(p => p.userId === (state.profileUserId || state.user.id)).slice(0,10).forEach(p=>targetIds.add(p.id));
    if (state.view === 'search') state.posts.filter(p => (p.content||'').toLowerCase().includes((state.searchQuery||'').toLowerCase())).slice(0,10).forEach(p=>targetIds.add(p.id));
    await Promise.all([...targetIds].map(async id => {
      try { state.commentsByPost[id] = await api(`/api/posts/${id}/comments`); } catch { state.commentsByPost[id] = []; }
    }));
  }
  async function loadAux() {
    if (!state.user) return;
    try { state.notifications = await api(`/api/notifications?userId=${encodeURIComponent(state.user.id)}`); } catch { state.notifications = []; }
    try { state.groups = await api('/api/groups'); } catch { state.groups = []; }
    try { state.messages = await api(`/api/messages?userId=${encodeURIComponent(state.user.id)}`); } catch { state.messages = []; }
    try { state.stories = await api('/api/stories'); } catch { state.stories = []; }
    try { state.marketplace = await api('/api/marketplace'); } catch { state.marketplace = []; }
    try { state.reports = await api('/api/reports'); } catch { state.reports = []; }
    renderNotifications();
  }
  async function loadFeed(reset = false) {
    if (!state.user || state._loadingFeed) return;
    state._loadingFeed = true;
    if (reset && state.view === 'home') $('#feedLoading')?.classList.remove('hidden');
    try {
      await loadUsers();
      await loadPosts(reset);
      await loadAux();
      if (state.view === 'groups') await loadGroupPosts();
      refreshSessionUser();
      state.lastUpdatedAt = new Date().toISOString();
      renderView();
      renderStatus();
    } finally { state._loadingFeed = false; $('#feedLoading')?.classList.add('hidden'); }
  }

  // Auth/session
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#authMsg').textContent = '';
    try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) }); setSession(data.user, data.token); await loadFeed(true); }
    catch (err) { $('#authMsg').textContent = err.message; }
  });
  $('#signupForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#authMsg').textContent = '';
    try { const data = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) }); setSession(data.user, data.token); await loadFeed(true); }
    catch (err) { $('#authMsg').textContent = err.message; }
  });
  $('#refreshBtn')?.addEventListener('click', async () => { if (!state.user) return; await loadFeed(true); });
  $('#logoutBtn').addEventListener('click', () => { $('#accountMenu').classList.add('hidden'); $('#profileBtn')?.setAttribute('aria-expanded','false'); setSession(null, ''); });
  $('#profileBtn').addEventListener('click', () => { const hidden = $('#accountMenu').classList.toggle('hidden'); $('#profileBtn').setAttribute('aria-expanded', String(!hidden)); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { $('#accountMenu').classList.add('hidden'); $('#profileBtn')?.setAttribute('aria-expanded','false'); $('#messengerOverlay').classList.add('hidden'); $('#notifDropdown').classList.add('hidden'); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#profileBtn') && !e.target.closest('#accountMenu')) $('#accountMenu').classList.add('hidden');
    if (!e.target.closest('#messengerBtn') && !e.target.closest('#messengerOverlay')) $('#messengerOverlay').classList.add('hidden');
    if (!e.target.closest('#notifBtn') && !e.target.closest('#notifDropdown')) $('#notifDropdown').classList.add('hidden');
  });
  $('#messengerBtn').addEventListener('click', () => { $('#messengerOverlay').classList.toggle('hidden'); renderMessengerOverlay(); });
  $('#closeMessenger').addEventListener('click', () => $('#messengerOverlay').classList.add('hidden'));
  $('#notifBtn').addEventListener('click', async () => { $('#notifDropdown').classList.toggle('hidden'); await loadAux(); });
  $('#markReadBtn').addEventListener('click', async () => { if (!state.user) return; await api('/api/notifications/read', { method:'POST', body: JSON.stringify({ userId: state.user.id }) }); await loadAux(); });

  $$('.nav-icon,[data-view]').forEach(el => el.addEventListener('click', (e) => {
    const view = el.dataset.view; if (!view) return; e.preventDefault();
    if (view === 'profile') state.profileUserId = state.user?.id || null;
    if (view === 'messenger') { /* handled */ }
    state.view = view; renderView();
    if (view === 'messenger') renderMessengerPage();
  }));

  $('#postBtn').addEventListener('click', async () => {
    const input = $('#postInput'); const content = input.value.trim();
    const imageUrl = ($('#postImageInput')?.value || '').trim();
    if (!content || !state.user) return;
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) { alert('Image URL must start with http(s)://'); return; }
    await api('/api/posts', { method: 'POST', body: JSON.stringify({ userId: state.user.id, content, imageUrl }) }).catch(e=>alert(e.message));
    trackEvent('post_create', { hasImage: !!imageUrl });
    input.value = ''; if ($('#postImageInput')) $('#postImageInput').value = ''; await loadFeed(true);
  });

  $('#globalSearch').addEventListener('input', (e) => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      if (state.view === 'search') renderView();
    }, 250);
  });
  $('#globalSearch').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    clearTimeout(state.searchTimer);
    state.searchQuery = e.target.value.trim();
    trackEvent('search', { query: state.searchQuery.slice(0,80) });
    state.view = 'search'; renderView();
  });

  $('#settingsForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    saveSettings({ lang: f.lang.value, audience: f.audience.value, showEmail: f.showEmail.checked, allowRequests: f.allowRequests.checked, storySharing: f.storySharing.checked, isModerator: f.isModerator.checked });
    applyI18n();
    $('#settingsMsg').textContent = 'Settings saved locally (mock).';
    renderProfile(); renderSettings();
  });

  $('#refreshDiagnosticsBtn')?.addEventListener('click', () => renderDiagnostics());
  $('#exportDataBtn')?.addEventListener('click', async () => {
    const data = await api('/api/admin/export').catch(err=>{ alert(err.message); return null; }); if (!data) return;
    const blob = new Blob([JSON.stringify(data.db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'facebook-clone-db.json'; a.click(); URL.revokeObjectURL(a.href);
  });
  $('#importDataBtn')?.addEventListener('click', async () => {
    const file = $('#importFile')?.files?.[0]; if (!file) return alert('Choose a JSON file');
    if (file.size > 2 * 1024 * 1024) return alert('File too large');
    if (!/\.json$/i.test(file.name)) return alert('Use a .json file');
    try {
      const text = await file.text(); const db = JSON.parse(text);
      const mode = $('#importMode').value || 'merge';
      await api('/api/admin/import', { method:'POST', body: JSON.stringify({ mode, db: db.db || db }) });
      alert('Import completed (mock). Reloading data.'); await loadFeed(true); renderDiagnostics();
    } catch (e) { alert(e.message || 'Import failed'); }
  });

  $('#marketplaceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (data.imageUrl && !/^https?:\/\//i.test(String(data.imageUrl))) { alert('Image URL must start with http(s)://'); return; }
    await api('/api/marketplace', { method:'POST', body: JSON.stringify({ ...data, userId: state.user.id }) }).catch(err=>alert(err.message));
    e.target.reset(); await loadAux(); renderMarketplace();
  });

  $('#groupCreateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name');
    await api('/api/groups', { method:'POST', body: JSON.stringify({ name, ownerId: state.user.id }) }).catch(err=>alert(err.message));
    e.target.reset(); await loadAux(); renderGroups();
  });

  document.addEventListener('click', async (e) => {
    if (e.target.id === 'loadMorePosts') { await loadPosts(false); renderPosts(); return; }
    if (e.target.closest('[data-post-menu]')) { const id = e.target.closest('[data-post-menu]').dataset.postMenu; $(`#post-menu-${id}`)?.classList.toggle('hidden'); return; }
    if (!e.target.closest('.post-menu-wrap')) $$('.post-menu').forEach(m => m.classList.add('hidden'));
    const editBtn = e.target.closest('[data-edit-post]');
    if (editBtn) { $(`#post-body-${editBtn.dataset.editPost}`)?.classList.add('hidden'); $(`#post-edit-${editBtn.dataset.editPost}`)?.classList.remove('hidden'); $(`#post-menu-${editBtn.dataset.editPost}`)?.classList.add('hidden'); return; }
    const cancelEdit = e.target.closest('[data-cancel-edit-post]');
    if (cancelEdit) { $(`#post-body-${cancelEdit.dataset.cancelEditPost}`)?.classList.remove('hidden'); $(`#post-edit-${cancelEdit.dataset.cancelEditPost}`)?.classList.add('hidden'); return; }
    const blockBtn = e.target.closest('[data-block-user]');
    if (blockBtn && state.user) { await api(`/api/users/${state.user.id}/block`, { method:'POST', body: JSON.stringify({ targetId: blockBtn.dataset.blockUser }) }).catch(err=>alert(err.message)); await loadFeed(true); return; }
    const delBtn = e.target.closest('[data-delete-post]');
    if (delBtn && state.user) { if (!confirm('Delete this post?')) return; await api(`/api/posts/${delBtn.dataset.deletePost}?userId=${encodeURIComponent(state.user.id)}`, { method:'DELETE' }).catch(err=>alert(err.message)); await loadFeed(true); return; }
    const reportPost = e.target.closest('[data-report-post]');
    if (reportPost && state.user) { const reason = prompt('Report reason (Spam, Harassment, Misinformation, Nudity, Violence, Other):', 'Spam') || 'Other'; await api('/api/reports', { method:'POST', body: JSON.stringify({ reporterId: state.user.id, targetType:'post', targetId: reportPost.dataset.reportPost, reason }) }).catch(err=>alert(err.message)); alert('Report submitted (mock).'); return; }
    const reportComment = e.target.closest('[data-report-comment]');
    if (reportComment && state.user) { const reason = prompt('Report reason (Harassment, Hate, Spam, Misinformation, Other):', 'Harassment') || 'Other'; await api('/api/reports', { method:'POST', body: JSON.stringify({ reporterId: state.user.id, targetType:'comment', targetId: reportComment.dataset.reportComment, reason }) }).catch(err=>alert(err.message)); alert('Report submitted (mock).'); return; }
    const resolve = e.target.closest('[data-resolve-report]');
    if (resolve) { await api(`/api/reports/${resolve.dataset.resolveReport}/resolve`, { method:'POST', body: JSON.stringify({ status: resolve.dataset.status }) }).catch(err=>alert(err.message)); await loadAux(); renderModeration(); return; }
    const reactBtn = e.target.closest('[data-react]');
    if (reactBtn && state.user) {
      await api(`/api/posts/${reactBtn.dataset.react}/react`, { method:'POST', body: JSON.stringify({ userId: state.user.id, reaction: reactBtn.dataset.reaction || 'like' }) }).catch(()=>{});
      await loadFeed(); return;
    }
    const likeBtn = e.target.closest('[data-like]');
    if (likeBtn && state.user) { await api(`/api/posts/${likeBtn.dataset.like}/like`, { method:'POST', body: JSON.stringify({ userId: state.user.id }) }).catch(()=>{}); await loadFeed(); return; }
    const shareBtn = e.target.closest('[data-share-post]');
    if (shareBtn && state.user) {
      if (state._sharing) return; state._sharing = true;
      await api(`/api/posts/${shareBtn.dataset.sharePost}/share`, { method:'POST', body: JSON.stringify({ userId: state.user.id }) }).catch(err=>alert(err.message));
      state._sharing = false; await loadFeed(true); return;
    }
    const saveBtn = e.target.closest('[data-save-post]');
    if (saveBtn && state.user) {
      await api(`/api/users/${state.user.id}/save`, { method:'POST', body: JSON.stringify({ postId: saveBtn.dataset.savePost }) }).catch(err=>alert(err.message));
      await loadFeed(); return;
    }
    const reactComment = e.target.closest('[data-react-comment]');
    if (reactComment && state.user) {
      await api(`/api/comments/${reactComment.dataset.reactComment}/react`, { method:'POST', body: JSON.stringify({ userId: state.user.id, reaction: reactComment.dataset.reaction || 'like' }) }).catch(()=>{});
      trackEvent('comment_react', { reaction: reactComment.dataset.reaction || 'like' });
      await loadFeed(); return;
    }
    const editComment = e.target.closest('[data-edit-comment]');
    if (editComment) { $(`#comment-body-${editComment.dataset.editComment}`)?.classList.add('hidden'); $(`#comment-edit-${editComment.dataset.editComment}`)?.classList.remove('hidden'); return; }
    const cancelEditComment = e.target.closest('[data-cancel-edit-comment]');
    if (cancelEditComment) { $(`#comment-body-${cancelEditComment.dataset.cancelEditComment}`)?.classList.remove('hidden'); $(`#comment-edit-${cancelEditComment.dataset.cancelEditComment}`)?.classList.add('hidden'); return; }
    const delComment = e.target.closest('[data-delete-comment]');
    if (delComment && state.user) { if (!confirm('Delete this comment and its replies?')) return; await api(`/api/comments/${delComment.dataset.deleteComment}?userId=${encodeURIComponent(state.user.id)}`, { method:'DELETE' }).catch(err=>alert(err.message)); await loadFeed(); return; }
    const replyBtn = e.target.closest('[data-reply-comment]');
    if (replyBtn) { const f = $(`form[data-comment-form="${replyBtn.dataset.postId}"][data-parent-id="${replyBtn.dataset.replyComment}"]`); f?.classList.toggle('hidden'); f?.querySelector('input')?.focus(); return; }
    const focusBtn = e.target.closest('[data-focus-comment]');
    if (focusBtn) { $(`[data-comment-form="${focusBtn.dataset.focusComment}"] input`)?.focus(); return; }
    const profileLink = e.target.closest('[data-open-profile]');
    if (profileLink) { e.preventDefault(); state.profileUserId = profileLink.dataset.openProfile; state.view = 'profile'; state._editingProfile = false; renderView(); return; }
    if (e.target.id === 'toggleEditProfile') { state._editingProfile = !state._editingProfile; renderProfile(); return; }
    const addFriend = e.target.closest('[data-add-friend]');
    if (addFriend) { await api('/api/friends/request', { method:'POST', body: JSON.stringify({ fromId: state.user.id, toId: addFriend.dataset.addFriend }) }).catch(err=>alert(err.message)); await loadFeed(); return; }
    const respond = e.target.closest('[data-respond-friend]');
    if (respond) { await api('/api/friends/respond', { method:'POST', body: JSON.stringify({ userId: state.user.id, fromId: respond.dataset.respondFriend, accept: respond.dataset.accept === '1' }) }).catch(err=>alert(err.message)); await loadFeed(); return; }
    const msgBtn = e.target.closest('[data-message-user]');
    if (msgBtn) { state.activeChatUserId = msgBtn.dataset.messageUser; state.view = 'messenger'; renderView(); renderMessengerPage(); $('#messengerOverlay').classList.remove('hidden'); renderMessengerOverlay(); return; }
    const chat = e.target.closest('[data-chat-user]');
    if (chat) { state.activeChatUserId = chat.dataset.chatUser; renderMessengerPage(); renderMessengerOverlay(); return; }
    const openGroup = e.target.closest('[data-open-group]');
    if (openGroup) { e.preventDefault(); state.activeGroupId = openGroup.dataset.openGroup; await loadGroupPosts(); renderGroups(); return; }
    const join = e.target.closest('[data-join-group]');
    if (join) { await api(`/api/groups/${join.dataset.joinGroup}/join`, { method:'POST', body: JSON.stringify({ userId: state.user.id }) }).catch(err=>alert(err.message)); state.activeGroupId = state.activeGroupId || join.dataset.joinGroup; await loadAux(); await loadGroupPosts(); renderGroups(); return; }
  });

  document.addEventListener('submit', async (e) => {
    const editPostForm = e.target.closest('[data-edit-form]');
    if (editPostForm && state.user) {
      e.preventDefault();
      const content = new FormData(editPostForm).get('content');
      await api(`/api/posts/${editPostForm.dataset.editForm}`, { method:'PATCH', body: JSON.stringify({ userId: state.user.id, content }) }).catch(err=>alert(err.message));
      await loadFeed(); return;
    }
    const editCommentForm = e.target.closest('[data-edit-comment-form]');
    if (editCommentForm && state.user) {
      e.preventDefault();
      const content = new FormData(editCommentForm).get('content');
      await api(`/api/comments/${editCommentForm.dataset.editCommentForm}`, { method:'PATCH', body: JSON.stringify({ userId: state.user.id, content }) }).catch(err=>alert(err.message));
      await loadFeed(); return;
    }
    const commentForm = e.target.closest('[data-comment-form]');
    if (commentForm && state.user) {
      e.preventDefault();
      const content = commentForm.querySelector('input').value.trim(); if (!content) return;
      const parentId = commentForm.dataset.parentId || null;
      await api(`/api/posts/${commentForm.dataset.commentForm}/comments`, { method:'POST', body: JSON.stringify({ userId: state.user.id, content, parentId }) }).catch(err=>alert(err.message));
      commentForm.reset(); if (parentId) commentForm.classList.add('hidden'); await loadFeed(); return;
    }
    if (e.target.id === 'profileEditForm') {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      await api(`/api/users/${state.user.id}`, { method:'PATCH', body: JSON.stringify(data) }).catch(err=>alert(err.message));
      state._editingProfile = false; await loadFeed(); return;
    }
    if (e.target.id === 'groupPostForm') {
      e.preventDefault();
      if (!state.activeGroupId) return;
      const content = new FormData(e.target).get('content');
      if (!String(content||'').trim()) return;
      await api(`/api/groups/${state.activeGroupId}/posts`, { method:'POST', body: JSON.stringify({ userId: state.user.id, content }) }).catch(err=>alert(err.message));
      e.target.reset(); await loadGroupPosts(); renderGroups(); return;
    }
    const chatForm = e.target.closest('[data-send-chat]');
    if (chatForm) {
      e.preventDefault();
      const content = chatForm.querySelector('input').value.trim(); if (!content) return;
      await api('/api/messages', { method:'POST', body: JSON.stringify({ fromId: state.user.id, toId: chatForm.dataset.sendChat, content }) }).catch(err=>alert(err.message));
      chatForm.reset(); await loadAux(); renderMessengerPage(); renderMessengerOverlay(); return;
    }
  });

  renderAuth();
  applyTheme();
  if (state.user) loadFeed(true).catch(()=>{});
  function updateOnline() { $('#offlineBadge')?.classList.toggle('hidden', navigator.onLine); renderStatus(); }
  window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline); updateOnline();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  setInterval(() => {
    if (!state.user || document.hidden || state._loadingFeed) return;
    const activeViews = ['home','messenger','moderation','groups','search'];
    if (!activeViews.includes(state.view)) return;
    loadAux().then(() => { state.lastUpdatedAt = new Date().toISOString(); renderView(); renderStatus(); }).catch(()=>{});
  }, 20000);
})();
