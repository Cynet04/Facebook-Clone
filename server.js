const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: [], posts: [], comments: [], messages: [], conversations: [], groups: [], notifications: [], stories: [] };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth (mock)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const db = readDB();
  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const { password: _pw, ...safe } = user;
  res.json({ user: safe, token: `mock_${user.id}` });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  if (db.users.some(u => u.email === email)) return res.status(409).json({ error: 'Email exists' });
  const user = { id: uid('u'), name, email, password, avatar: '', cover: '', friends: [], friendRequests: [], createdAt: new Date().toISOString() };
  db.users.push(user);
  writeDB(db);
  const { password: _pw, ...safe } = user;
  res.json({ user: safe, token: `mock_${user.id}` });
});

// Users
app.get('/api/users', (req, res) => {
  const db = readDB();
  res.json(db.users.map(({ password, ...u }) => u));
});
app.get('/api/users/:id', (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { password, ...safe } = user;
  res.json(safe);
});
app.patch('/api/users/:id', (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { name, avatar, cover, bio } = req.body || {};
  if (name !== undefined) user.name = String(name).slice(0, 80);
  if (avatar !== undefined) user.avatar = String(avatar).slice(0, 500);
  if (cover !== undefined) user.cover = String(cover).slice(0, 500);
  if (bio !== undefined) user.bio = String(bio).slice(0, 280);
  writeDB(db);
  const { password, ...safe } = user;
  res.json(safe);
});

// Posts
app.get('/api/posts', (req, res) => {
  const db = readDB();
  const posts = [...(db.posts || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts);
});
app.post('/api/posts', (req, res) => {
  const { userId, content } = req.body || {};
  if (!userId || !content) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const post = { id: uid('p'), userId, content, likes: [], reactions: {}, createdAt: new Date().toISOString() };
  db.posts = db.posts || [];
  db.posts.push(post);
  writeDB(db);
  res.status(201).json(post);
});
app.post('/api/posts/:id/like', (req, res) => {
  const { userId } = req.body || {};
  const db = readDB();
  const post = (db.posts || []).find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  post.likes = post.likes || [];
  post.reactions = post.reactions || {};
  const idx = post.likes.indexOf(userId);
  if (idx >= 0) { post.likes.splice(idx, 1); delete post.reactions[userId]; }
  else {
    post.likes.push(userId);
    post.reactions[userId] = 'like';
    if (post.userId && post.userId !== userId) {
      db.notifications = db.notifications || [];
      db.notifications.push({ id: uid('n'), userId: post.userId, type: 'like', actorId: userId, postId: post.id, read: false, createdAt: new Date().toISOString() });
    }
  }
  writeDB(db);
  res.json(post);
});
app.post('/api/posts/:id/react', (req, res) => {
  const { userId, reaction } = req.body || {};
  const allowed = new Set(['like','love','haha','wow','sad','angry']);
  if (!userId || !allowed.has(reaction)) return res.status(400).json({ error: 'Invalid reaction' });
  const db = readDB();
  const post = (db.posts || []).find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  post.likes = post.likes || [];
  post.reactions = post.reactions || {};
  const prev = post.reactions[userId];
  if (prev === reaction) {
    delete post.reactions[userId];
    post.likes = post.likes.filter(id => id !== userId);
  } else {
    post.reactions[userId] = reaction;
    if (!post.likes.includes(userId)) post.likes.push(userId);
    if (post.userId && post.userId !== userId && !prev) {
      db.notifications = db.notifications || [];
      db.notifications.push({ id: uid('n'), userId: post.userId, type: 'reaction', actorId: userId, postId: post.id, reaction, read: false, createdAt: new Date().toISOString() });
    }
  }
  writeDB(db);
  res.json(post);
});

// Comments
app.get('/api/posts/:id/comments', (req, res) => {
  const db = readDB();
  res.json((db.comments || []).filter(c => c.postId === req.params.id));
});
app.post('/api/posts/:id/comments', (req, res) => {
  const { userId, content } = req.body || {};
  if (!userId || !content) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const comment = { id: uid('c'), postId: req.params.id, userId, content, createdAt: new Date().toISOString() };
  db.comments = db.comments || [];
  db.comments.push(comment);
  const post = (db.posts || []).find(p => p.id === req.params.id);
  if (post && post.userId && post.userId !== userId) {
    db.notifications = db.notifications || [];
    db.notifications.push({ id: uid('n'), userId: post.userId, type: 'comment', actorId: userId, postId: post.id, read: false, createdAt: new Date().toISOString() });
  }
  writeDB(db);
  res.status(201).json(comment);
});

// Friends (Phase 5 base)
app.post('/api/friends/request', (req, res) => {
  const { fromId, toId } = req.body || {};
  if (!fromId || !toId || fromId === toId) return res.status(400).json({ error: 'Invalid request' });
  const db = readDB();
  const from = db.users.find(u => u.id === fromId);
  const to = db.users.find(u => u.id === toId);
  if (!from || !to) return res.status(404).json({ error: 'User not found' });
  from.friends = from.friends || []; to.friends = to.friends || [];
  to.friendRequests = to.friendRequests || [];
  if (from.friends.includes(toId) || to.friendRequests.includes(fromId)) return res.json({ ok: true, status: 'noop' });
  to.friendRequests.push(fromId);
  db.notifications = db.notifications || [];
  db.notifications.push({ id: uid('n'), userId: toId, type: 'friend_request', actorId: fromId, read: false, createdAt: new Date().toISOString() });
  writeDB(db);
  res.json({ ok: true });
});
app.post('/api/friends/respond', (req, res) => {
  const { userId, fromId, accept } = req.body || {};
  const db = readDB();
  const user = db.users.find(u => u.id === userId);
  const from = db.users.find(u => u.id === fromId);
  if (!user || !from) return res.status(404).json({ error: 'User not found' });
  user.friendRequests = (user.friendRequests || []).filter(id => id !== fromId);
  user.friends = user.friends || []; from.friends = from.friends || [];
  if (accept) {
    if (!user.friends.includes(fromId)) user.friends.push(fromId);
    if (!from.friends.includes(userId)) from.friends.push(userId);
  }
  writeDB(db);
  res.json({ ok: true, friends: user.friends, friendRequests: user.friendRequests });
});

// Notifications (Phase 8 base)
app.get('/api/notifications', (req, res) => {
  const { userId } = req.query || {};
  const db = readDB();
  const list = (db.notifications || []).filter(n => !userId || n.userId === userId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  res.json(list);
});
app.post('/api/notifications/read', (req, res) => {
  const { userId } = req.body || {};
  const db = readDB();
  (db.notifications || []).forEach(n => { if (!userId || n.userId === userId) n.read = true; });
  writeDB(db);
  res.json({ ok: true });
});

// Groups (Phase 7)
app.get('/api/groups', (req, res) => {
  const db = readDB();
  res.json([...(db.groups || [])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
});
app.post('/api/groups', (req, res) => {
  const { name, ownerId } = req.body || {};
  if (!name || !ownerId) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const group = { id: uid('g'), name: String(name).slice(0, 120), ownerId, members: [ownerId], posts: [], createdAt: new Date().toISOString() };
  db.groups = db.groups || [];
  db.groups.push(group);
  writeDB(db);
  res.status(201).json(group);
});
app.post('/api/groups/:id/join', (req, res) => {
  const { userId } = req.body || {};
  const db = readDB();
  const group = (db.groups || []).find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  group.members = group.members || [];
  if (userId && !group.members.includes(userId)) group.members.push(userId);
  writeDB(db);
  res.json(group);
});

// Messenger (Phase 6)
app.get('/api/messages', (req, res) => {
  const { userId } = req.query || {};
  const db = readDB();
  const msgs = (db.messages || []).filter(m => !userId || m.fromId === userId || m.toId === userId);
  res.json(msgs.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)));
});
app.post('/api/messages', (req, res) => {
  const { fromId, toId, content } = req.body || {};
  if (!fromId || !toId || !content) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const msg = { id: uid('m'), fromId, toId, content: String(content).slice(0, 2000), createdAt: new Date().toISOString() };
  db.messages = db.messages || [];
  db.messages.push(msg);
  db.notifications = db.notifications || [];
  db.notifications.push({ id: uid('n'), userId: toId, type: 'message', actorId: fromId, read: false, createdAt: new Date().toISOString() });
  writeDB(db);
  res.status(201).json(msg);
});

// Stories (Phase 11)
app.get('/api/stories', (req, res) => {
  const db = readDB();
  const now = Date.now();
  const stories = (db.stories || []).filter(s => now - new Date(s.createdAt).getTime() < 24 * 60 * 60 * 1000)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  res.json(stories);
});
app.post('/api/stories', (req, res) => {
  const { userId, text, bg } = req.body || {};
  if (!userId || !text) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const story = { id: uid('s'), userId, text: String(text).slice(0, 180), bg: String(bg || '#1877f2').slice(0, 120), createdAt: new Date().toISOString() };
  db.stories = db.stories || [];
  db.stories.push(story);
  writeDB(db);
  res.status(201).json(story);
});

// SPA-ish fallback for hash routing / direct loads
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = { app, readDB, writeDB, DB_PATH };
