(() => {
  const state = {
    user: JSON.parse(localStorage.getItem('fb_user') || 'null'),
    token: localStorage.getItem('fb_token') || '',
    users: [],
    posts: [],
    notifications: [],
    groups: [],
    conversations: [],
    messages: [],
    activeChatUserId: null,
    commentsByPost: {},
    view: 'home',
    profileUserId: null,
    searchQuery: ''
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

  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function setSession(user, token) {
    state.user = user; state.token = token;
    if (user) localStorage.setItem('fb_user', JSON.stringify(user)); else localStorage.removeItem('fb_user');
    if (token) localStorage.setItem('fb_token', token); else localStorage.removeItem('fb_token');
    renderAuth();
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
    ['home','profile','friends','groups','messenger','search'].forEach(v => $(`#${v}View`)?.classList.toggle('hidden', state.view !== v));
    $$('.nav-icon').forEach(el => el.classList.toggle('active', el.dataset.view === state.view));
    if (state.view === 'profile') renderProfile();
    if (state.view === 'home') renderPosts();
    if (state.view === 'friends') renderFriends();
    if (state.view === 'groups') renderGroups();
    if (state.view === 'messenger') renderMessengerPage();
    if (state.view === 'search') renderSearch();
  }

  function userById(id) { return state.users.find(u => u.id === id) || { name: 'Unknown User', id }; }

  function postCard(p) {
    const u = userById(p.userId);
    const liked = (p.likes || []).includes(state.user?.id);
    const comments = (state.commentsByPost?.[p.id] || []);
    return `
      <article class="card post" data-post-id="${esc(p.id)}">
        <div class="post-head">
          <span class="avatar-sm">${esc(initials(u.name))}</span>
          <div>
            <div class="post-author"><a href="#" data-open-profile="${esc(u.id)}">${esc(u.name)}</a></div>
            <div class="post-time">${esc(timeAgo(p.createdAt))}</div>
          </div>
        </div>
        <div class="post-body">${esc(p.content)}</div>
        <div class="post-stats"><span>${(p.likes||[]).length} likes</span><span>${comments.length} comments</span></div>
        <div class="post-actions">
          <button data-like="${esc(p.id)}" class="${liked?'liked':''}">👍 Like</button>
          <button data-focus-comment="${esc(p.id)}">💬 Comment</button>
        </div>
        <div class="comments">
          ${comments.map(c => `<div class="comment"><strong>${esc(userById(c.userId).name)}</strong>${esc(c.content)}</div>`).join('')}
          <form class="comment-form" data-comment-form="${esc(p.id)}">
            <input name="content" placeholder="Write a comment..." maxlength="500" />
          </form>
        </div>
      </article>`;
  }

  function renderPosts() {
    const container = $('#postsContainer');
    if (!state.posts.length) {
      container.innerHTML = `<div class="card muted">No posts yet. Be the first to post.</div>`;
      return;
    }
    container.innerHTML = state.posts.map(p => postCard(p)).join('');
  }

  function renderProfile() {
    const id = state.profileUserId || state.user.id;
    const u = userById(id);
    const me = state.user;
    const isMe = u.id === me.id;
    $('#profileName').textContent = u.name || 'User';
    $('#profileAvatar').textContent = initials(u.name);
    $('#profileBio').textContent = u.bio || '';
    $('#profileSub').textContent = `${(u.friends||[]).length} friends`;
    if (u.cover) $('#profileCover').style.background = u.cover;
    const reqSent = (u.friendRequests || []).includes(me.id);
    const reqIncoming = (me.friendRequests || []).includes(u.id);
    const isFriend = (me.friends || []).includes(u.id);
    let actions = '';
    if (isMe) actions = `<button class="btn small" id="toggleEditProfile">Edit Profile</button>`;
    else if (isFriend) actions = `<span class="pill">Friends</span><button class="btn small" data-message-user="${esc(u.id)}">Message</button>`;
    else if (reqIncoming) actions = `<button class="btn primary small" data-respond-friend="${esc(u.id)}" data-accept="1">Confirm</button><button class="btn small" data-respond-friend="${esc(u.id)}" data-accept="0">Delete</button>`;
    else if (reqSent) actions = `<span class="pill">Request sent</span>`;
    else actions = `<button class="btn primary small" data-add-friend="${esc(u.id)}">Add Friend</button><button class="btn small" data-message-user="${esc(u.id)}">Message</button>`;
    $('#profileActions').innerHTML = actions;
    $('#profileEditCard').classList.toggle('hidden', !(isMe && state._editingProfile));
    if (isMe) {
      const f = $('#profileEditForm');
      f.name.value = u.name || ''; f.bio.value = u.bio || ''; f.cover.value = u.cover || '';
    }
    const mine = state.posts.filter(p => p.userId === id);
    $('#profilePosts').innerHTML = mine.length ? mine.map(p => postCard(p)).join('') : `<div class="card muted">No posts on this timeline yet.</div>`;
  }

  function renderContactsInto(sel) {
    const list = state.users.filter(u => u.id !== state.user?.id);
    const html = list.map(u => `<div class="contact menu-item" data-open-profile="${esc(u.id)}"><span class="avatar-sm">${esc(initials(u.name))}</span><span>${esc(u.name)}</span></div>`).join('') || '<div class="muted">No contacts.</div>';
    const el = $(sel); if (el) el.innerHTML = html;
  }

  function renderFriends() {
    const me = userById(state.user.id);
    const reqs = (me.friendRequests || []).map(id => userById(id));
    $('#friendRequests').innerHTML = reqs.length ? reqs.map(u => `<div class="list-row"><span class="row gap"><span class="avatar-sm">${esc(initials(u.name))}</span><strong>${esc(u.name)}</strong></span><span class="row gap"><button class="btn primary small" data-respond-friend="${esc(u.id)}" data-accept="1">Confirm</button><button class="btn small" data-respond-friend="${esc(u.id)}" data-accept="0">Delete</button></span></div>`).join('') : '<div class="muted">No friend requests.</div>';
    const people = state.users.filter(u => u.id !== me.id && !(me.friends||[]).includes(u.id) && !(me.friendRequests||[]).includes(u.id));
    $('#peopleList').innerHTML = people.length ? people.map(u => `<div class="list-row"><a href="#" data-open-profile="${esc(u.id)}" class="row gap"><span class="avatar-sm">${esc(initials(u.name))}</span><span>${esc(u.name)}</span></a><button class="btn primary small" data-add-friend="${esc(u.id)}">Add Friend</button></div>`).join('') : '<div class="muted">No suggestions.</div>';
    const friends = (me.friends || []).map(id => userById(id));
    $('#friendsList').innerHTML = friends.length ? friends.map(u => `<div class="list-row"><a href="#" data-open-profile="${esc(u.id)}" class="row gap"><span class="avatar-sm">${esc(initials(u.name))}</span><span>${esc(u.name)}</span></a><button class="btn small" data-message-user="${esc(u.id)}">Message</button></div>`).join('') : '<div class="muted">No friends yet.</div>';
  }

  function renderGroups() {
    $('#groupsList').innerHTML = state.groups.length ? state.groups.map(g => `<div class="list-row"><span><strong>${esc(g.name)}</strong> <span class="muted">· ${(g.members||[]).length} members</span></span><button class="btn small" data-join-group="${esc(g.id)}">${(g.members||[]).includes(state.user.id)?'Joined':'Join'}</button></div>`).join('') : '<div class="muted">No groups yet.</div>';
  }

  function notifText(n) {
    const actor = userById(n.actorId).name;
    if (n.type === 'like') return `${actor} liked your post.`;
    if (n.type === 'comment') return `${actor} commented on your post.`;
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
    const users = threadUsers();
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

  function renderSearch() {
    const q = state.searchQuery.toLowerCase();
    const users = state.users.filter(u => (u.name||'').toLowerCase().includes(q));
    const posts = state.posts.filter(p => (p.content||'').toLowerCase().includes(q));
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
    await Promise.all(state.posts.slice(0, 25).map(async p => {
      try { state.commentsByPost[p.id] = await api(`/api/posts/${p.id}/comments`); } catch { state.commentsByPost[p.id] = []; }
    }));
  }
  async function loadAux() {
    if (!state.user) return;
    try { state.notifications = await api(`/api/notifications?userId=${encodeURIComponent(state.user.id)}`); } catch { state.notifications = []; }
    try { state.groups = await api('/api/groups'); } catch { state.groups = []; }
    try { state.messages = await api(`/api/messages?userId=${encodeURIComponent(state.user.id)}`); } catch { state.messages = []; }
    renderNotifications();
  }
  async function loadFeed() {
    if (!state.user) return;
    await loadUsers();
    state.posts = await api('/api/posts');
    await loadCommentsForPosts();
    await loadAux();
    refreshSessionUser();
    renderView();
  }

  // Auth/session
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#authMsg').textContent = '';
    try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) }); setSession(data.user, data.token); await loadFeed(); }
    catch (err) { $('#authMsg').textContent = err.message; }
  });
  $('#signupForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#authMsg').textContent = '';
    try { const data = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) }); setSession(data.user, data.token); await loadFeed(); }
    catch (err) { $('#authMsg').textContent = err.message; }
  });
  $('#logoutBtn').addEventListener('click', () => { $('#accountMenu').classList.add('hidden'); setSession(null, ''); });
  $('#profileBtn').addEventListener('click', () => $('#accountMenu').classList.toggle('hidden'));
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
    if (!content || !state.user) return;
    await api('/api/posts', { method: 'POST', body: JSON.stringify({ userId: state.user.id, content }) }).catch(e=>alert(e.message));
    input.value = ''; await loadFeed();
  });

  $('#globalSearch').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    state.searchQuery = e.target.value.trim();
    state.view = 'search'; renderView();
  });

  $('#groupCreateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name');
    await api('/api/groups', { method:'POST', body: JSON.stringify({ name, ownerId: state.user.id }) }).catch(err=>alert(err.message));
    e.target.reset(); await loadAux(); renderGroups();
  });

  document.addEventListener('click', async (e) => {
    const likeBtn = e.target.closest('[data-like]');
    if (likeBtn && state.user) { await api(`/api/posts/${likeBtn.dataset.like}/like`, { method:'POST', body: JSON.stringify({ userId: state.user.id }) }).catch(()=>{}); await loadFeed(); return; }
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
    const join = e.target.closest('[data-join-group]');
    if (join) { await api(`/api/groups/${join.dataset.joinGroup}/join`, { method:'POST', body: JSON.stringify({ userId: state.user.id }) }).catch(err=>alert(err.message)); await loadAux(); renderGroups(); return; }
  });

  document.addEventListener('submit', async (e) => {
    const commentForm = e.target.closest('[data-comment-form]');
    if (commentForm && state.user) {
      e.preventDefault();
      const content = commentForm.querySelector('input').value.trim(); if (!content) return;
      await api(`/api/posts/${commentForm.dataset.commentForm}/comments`, { method:'POST', body: JSON.stringify({ userId: state.user.id, content }) }).catch(err=>alert(err.message));
      commentForm.reset(); await loadFeed(); return;
    }
    if (e.target.id === 'profileEditForm') {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      await api(`/api/users/${state.user.id}`, { method:'PATCH', body: JSON.stringify(data) }).catch(err=>alert(err.message));
      state._editingProfile = false; await loadFeed(); return;
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
  if (state.user) loadFeed().catch(()=>{});
  setInterval(() => { if (state.user) loadAux().catch(()=>{}); }, 15000);
})();
