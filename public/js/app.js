(() => {
  const state = {
    user: JSON.parse(localStorage.getItem('fb_user') || 'null'),
    token: localStorage.getItem('fb_token') || '',
    users: [],
    posts: [],
    view: 'home',
    profileUserId: null
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = (name) => (name || 'U').trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||'').join('') || 'U';
  const timeAgo = (iso) => {
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

  function renderAuth() {
    const authed = !!state.user;
    $('#authGate').classList.toggle('hidden', authed);
    $('#mainView').classList.toggle('hidden', !authed);
    $('#composerCard').classList.toggle('hidden', !authed);
    $('#accountInfo').textContent = authed ? `${state.user.name} (${state.user.email})` : '';
    const name = state.user?.name || 'User';
    const ini = initials(name);
    $('#navAvatar').textContent = ini;
    $('#sideAvatar').textContent = ini;
    $('#composerAvatar').textContent = ini;
    $('#sideName').textContent = name;
    renderView();
  }

  function renderView() {
    if (!state.user) return;
    $('#homeView').classList.toggle('hidden', state.view !== 'home');
    $('#profileView').classList.toggle('hidden', state.view !== 'profile');
    $('#friendsView').classList.toggle('hidden', state.view !== 'friends');
    $('#groupsView').classList.toggle('hidden', state.view !== 'groups');
    $$('.nav-icon').forEach(el => el.classList.toggle('active', el.dataset.view === state.view));
    if (state.view === 'profile') renderProfile();
    if (state.view === 'home') renderPosts();
    if (state.view === 'friends') renderContactsInto('#friendsList');
  }

  function userById(id) { return state.users.find(u => u.id === id) || { name: 'Unknown User', id }; }

  function postCard(p, opts = {}) {
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
    $('#profileName').textContent = u.name || 'User';
    $('#profileAvatar').textContent = initials(u.name);
    $('#profileSub').textContent = u.email ? `${u.email}` : 'Timeline';
    const mine = state.posts.filter(p => p.userId === id);
    $('#profilePosts').innerHTML = mine.length ? mine.map(p => postCard(p)).join('') : `<div class="card muted">No posts on this timeline yet.</div>`;
  }

  function renderContactsInto(sel) {
    const list = state.users.filter(u => u.id !== state.user?.id);
    const html = list.map(u => `<div class="contact menu-item" data-open-profile="${esc(u.id)}"><span class="avatar-sm">${esc(initials(u.name))}</span><span>${esc(u.name)}</span></div>`).join('') || '<div class="muted">No contacts.</div>';
    const el = $(sel);
    if (el) el.innerHTML = html;
  }

  async function loadUsers() { state.users = await api('/api/users'); renderContactsInto('#contactsList'); }
  async function loadCommentsForPosts() {
    state.commentsByPost = {};
    await Promise.all(state.posts.slice(0, 20).map(async p => {
      try { state.commentsByPost[p.id] = await api(`/api/posts/${p.id}/comments`); } catch { state.commentsByPost[p.id] = []; }
    }));
  }
  async function loadFeed() {
    if (!state.user) return;
    await loadUsers();
    state.posts = await api('/api/posts');
    await loadCommentsForPosts();
    renderView();
  }

  // Events
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#authMsg').textContent = '';
    const fd = new FormData(e.target);
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
      setSession(data.user, data.token);
      await loadFeed();
    } catch (err) { $('#authMsg').textContent = err.message; }
  });
  $('#signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#authMsg').textContent = '';
    const fd = new FormData(e.target);
    try {
      const data = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
      setSession(data.user, data.token);
      await loadFeed();
    } catch (err) { $('#authMsg').textContent = err.message; }
  });
  $('#logoutBtn').addEventListener('click', () => { $('#accountMenu').classList.add('hidden'); setSession(null, ''); });
  $('#profileBtn').addEventListener('click', () => $('#accountMenu').classList.toggle('hidden'));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#profileBtn') && !e.target.closest('#accountMenu')) $('#accountMenu').classList.add('hidden');
    if (!e.target.closest('#messengerBtn') && !e.target.closest('#messengerOverlay')) $('#messengerOverlay').classList.add('hidden');
    if (!e.target.closest('#notifBtn') && !e.target.closest('#notifDropdown')) $('#notifDropdown').classList.add('hidden');
  });
  $('#messengerBtn').addEventListener('click', () => $('#messengerOverlay').classList.toggle('hidden'));
  $('#closeMessenger').addEventListener('click', () => $('#messengerOverlay').classList.add('hidden'));
  $('#notifBtn').addEventListener('click', () => $('#notifDropdown').classList.toggle('hidden'));

  $$('.nav-icon,[data-view]').forEach(el => el.addEventListener('click', (e) => {
    const view = el.dataset.view;
    if (!view) return;
    e.preventDefault();
    if (view === 'profile') state.profileUserId = state.user?.id || null;
    state.view = view;
    renderView();
  }));

  $('#postBtn').addEventListener('click', async () => {
    const input = $('#postInput');
    const content = input.value.trim();
    if (!content || !state.user) return;
    try {
      await api('/api/posts', { method: 'POST', body: JSON.stringify({ userId: state.user.id, content }) });
      input.value = '';
      await loadFeed();
    } catch (err) { alert(err.message); }
  });

  document.addEventListener('click', async (e) => {
    const likeBtn = e.target.closest('[data-like]');
    if (likeBtn && state.user) {
      await api(`/api/posts/${likeBtn.dataset.like}/like`, { method: 'POST', body: JSON.stringify({ userId: state.user.id }) }).catch(()=>{});
      await loadFeed();
    }
    const focusBtn = e.target.closest('[data-focus-comment]');
    if (focusBtn) $(`[data-comment-form="${focusBtn.dataset.focusComment}"] input`)?.focus();
    const profileLink = e.target.closest('[data-open-profile]');
    if (profileLink) { e.preventDefault(); state.profileUserId = profileLink.dataset.openProfile; state.view = 'profile'; renderView(); }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-comment-form]');
    if (!form || !state.user) return;
    e.preventDefault();
    const input = form.querySelector('input');
    const content = input.value.trim();
    if (!content) return;
    try {
      await api(`/api/posts/${form.dataset.commentForm}/comments`, { method: 'POST', body: JSON.stringify({ userId: state.user.id, content }) });
      input.value = '';
      await loadFeed();
    } catch (err) { alert(err.message); }
  });

  renderAuth();
  if (state.user) loadFeed();
})();
