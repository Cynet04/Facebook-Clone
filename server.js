const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors({ origin: true, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '256kb' }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

const rateBuckets = new Map();
function rateLimit(keyFn, limit, windowMs) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const b = rateBuckets.get(key) || { count: 0, reset: now + windowMs };
    if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
    b.count += 1; rateBuckets.set(key, b);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - b.count)));
    if (b.count > limit) return res.status(429).json({ error: 'Rate limit exceeded (mock). Try again later.' });
    next();
  };
}
const authLimit = rateLimit(req => `auth:${req.ip}`, 30, 10 * 60 * 1000);
const writeLimit = rateLimit(req => `write:${req.ip}:${req.path}`, 120, 10 * 60 * 1000);

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: [], posts: [], comments: [], messages: [], conversations: [], groups: [], notifications: [], stories: [], marketplace: [], reports: [], events: [] };
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
app.post('/api/auth/login', authLimit, (req, res) => {
  const { email, password } = req.body || {};
  const db = readDB();
  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const { password: _pw, ...safe } = user;
  res.json({ user: safe, token: `mock_${user.id}` });
});

app.post('/api/auth/signup', authLimit, (req, res) => {
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
  safe.savedPosts = safe.savedPosts || [];
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
  safe.savedPosts = safe.savedPosts || [];
  res.json(safe);
});
app.post('/api/users/:id/block', (req, res) => {
  const { targetId } = req.body || {};
  if (!targetId || targetId === req.params.id) return res.status(400).json({ error: 'Invalid target' });
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.blockedUsers = user.blockedUsers || [];
  user.friends = (user.friends || []).filter(id => id !== targetId);
  user.friendRequests = (user.friendRequests || []).filter(id => id !== targetId);
  const target = db.users.find(u => u.id === targetId);
  if (target) { target.friends = (target.friends || []).filter(id => id !== user.id); target.friendRequests = (target.friendRequests || []).filter(id => id !== user.id); }
  const idx = user.blockedUsers.indexOf(targetId);
  if (idx >= 0) user.blockedUsers.splice(idx, 1); else user.blockedUsers.push(targetId);
  writeDB(db);
  res.json({ blockedUsers: user.blockedUsers });
});

app.post('/api/users/:id/save', (req, res) => {
  const { postId } = req.body || {};
  if (!postId) return res.status(400).json({ error: 'Missing postId' });
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.savedPosts = user.savedPosts || [];
  const idx = user.savedPosts.indexOf(postId);
  if (idx >= 0) user.savedPosts.splice(idx, 1); else user.savedPosts.unshift(postId);
  writeDB(db);
  res.json({ savedPosts: user.savedPosts });
});

function publishDueScheduled(db) {
  const now = Date.now();
  let changed = false;
  (db.posts || []).forEach(p => {
    if (p.status === 'scheduled' && p.scheduledFor && new Date(p.scheduledFor).getTime() <= now) {
      p.status = 'published';
      p.createdAt = new Date().toISOString();
      delete p.scheduledFor;
      changed = true;
    }
  });
  (db.stories || []).forEach(s => {
    if (s.status === 'scheduled' && s.scheduledFor && new Date(s.scheduledFor).getTime() <= now) {
      s.status = 'published';
      s.createdAt = new Date().toISOString();
      delete s.scheduledFor;
      changed = true;
    }
  });
  return changed;
}

// Posts
app.get('/api/posts', (req, res) => {
  const db = readDB();
  const includeScheduled = req.query.includeScheduled === '1';
  const userId = req.query.userId;
  const changed = publishDueScheduled(db);
  if (changed) writeDB(db);
  let posts = [...(db.posts || [])].filter(p => (p.status || 'published') === 'published' || (includeScheduled && userId && p.userId === userId && p.status === 'scheduled'));
  posts.sort((a, b) => new Date(b.createdAt || b.scheduledFor || 0) - new Date(a.createdAt || a.scheduledFor || 0));
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  if (!limit && !offset) return res.json(posts);
  res.json({ items: posts.slice(offset, offset + limit), total: posts.length, offset, limit });
});
app.post('/api/posts', writeLimit, (req, res) => {
  const { userId, content, imageUrl, scheduledFor } = req.body || {};
  if (!userId || !content) return res.status(400).json({ error: 'Missing fields' });
  const img = String(imageUrl || '').trim();
  if (img && !/^https?:\/\//i.test(img)) return res.status(400).json({ error: 'Image URL must start with http(s)://' });
  let sched = null;
  if (scheduledFor) {
    const t = new Date(scheduledFor).getTime();
    if (!Number.isFinite(t) || t <= Date.now() + 30 * 1000) return res.status(400).json({ error: 'scheduledFor must be > 30s in future' });
    sched = new Date(t).toISOString();
  }
  const db = readDB();
  const post = { id: uid('p'), userId, content: String(content).slice(0, 5000), imageUrl: img.slice(0, 500), likes: [], reactions: {}, shares: 0, status: sched ? 'scheduled' : 'published', createdAt: sched ? null : new Date().toISOString(), ...(sched ? { scheduledFor: sched } : {}) };
  db.posts = db.posts || [];
  db.posts.push(post);
  writeDB(db);
  res.status(201).json(post);
});
app.patch('/api/posts/:id', (req, res) => {
  const { userId, content } = req.body || {};
  if (!userId || !String(content || '').trim()) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const post = (db.posts || []).find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  if (post.userId !== userId) return res.status(403).json({ error: 'Not allowed' });
  post.content = String(content).slice(0, 5000);
  post.editedAt = new Date().toISOString();
  writeDB(db);
  res.json(post);
});
app.delete('/api/posts/:id', (req, res) => {
  const userId = req.body?.userId || req.query?.userId;
  const db = readDB();
  const idx = (db.posts || []).findIndex(p => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  if (db.posts[idx].userId !== userId) return res.status(403).json({ error: 'Not allowed' });
  db.posts.splice(idx, 1);
  db.comments = (db.comments || []).filter(c => c.postId !== req.params.id);
  (db.users || []).forEach(u => { if (Array.isArray(u.savedPosts)) u.savedPosts = u.savedPosts.filter(id => id !== req.params.id); });
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/posts/:id/share', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const original = (db.posts || []).find(p => p.id === req.params.id);
  if (!original) return res.status(404).json({ error: 'Not found' });
  original.shares = original.shares || 0;
  original.shares += 1;
  const shared = {
    id: uid('p'),
    userId,
    content: original.content || '',
    imageUrl: original.imageUrl || '',
    likes: [], reactions: {}, shares: 0,
    sharedFrom: { postId: original.id, userId: original.userId, createdAt: original.createdAt },
    createdAt: new Date().toISOString()
  };
  db.posts = db.posts || [];
  db.posts.push(shared);
  if (original.userId && original.userId !== userId) {
    db.notifications = db.notifications || [];
    db.notifications.push({ id: uid('n'), userId: original.userId, type: 'share', actorId: userId, postId: original.id, read: false, createdAt: new Date().toISOString() });
  }
  writeDB(db);
  res.status(201).json(shared);
});

app.post('/api/posts/:id/like', writeLimit, (req, res) => {
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
app.post('/api/posts/:id/react', writeLimit, (req, res) => {
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
app.post('/api/posts/:id/comments', writeLimit, (req, res) => {
  const { userId, content, parentId } = req.body || {};
  if (!userId || !content) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const comment = { id: uid('c'), postId: req.params.id, userId, parentId: parentId || null, content: String(content).slice(0, 1000), reactions: {}, likes: [], createdAt: new Date().toISOString() };
  db.comments = db.comments || [];
  db.comments.push(comment);
  const post = (db.posts || []).find(p => p.id === req.params.id);
  if (post && post.userId && post.userId !== userId) {
    db.notifications = db.notifications || [];
    db.notifications.push({ id: uid('n'), userId: post.userId, type: 'comment', actorId: userId, postId: post.id, read: false, createdAt: new Date().toISOString() });
  }
  if (parentId) {
    const parent = db.comments.find(c => c.id === parentId);
    if (parent && parent.userId && parent.userId !== userId) {
      db.notifications = db.notifications || [];
      db.notifications.push({ id: uid('n'), userId: parent.userId, type: 'reply', actorId: userId, postId: post?.id, commentId: parent.id, read: false, createdAt: new Date().toISOString() });
    }
  }
  writeDB(db);
  res.status(201).json(comment);
});
app.patch('/api/comments/:id', (req, res) => {
  const { userId, content } = req.body || {};
  if (!userId || !String(content || '').trim()) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const comment = (db.comments || []).find(c => c.id === req.params.id);
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.userId !== userId) return res.status(403).json({ error: 'Not allowed' });
  comment.content = String(content).slice(0, 1000);
  comment.editedAt = new Date().toISOString();
  writeDB(db);
  res.json(comment);
});
app.delete('/api/comments/:id', (req, res) => {
  const userId = req.body?.userId || req.query?.userId;
  const db = readDB();
  const all = db.comments || [];
  const target = all.find(c => c.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.userId !== userId) return res.status(403).json({ error: 'Not allowed' });
  const remove = new Set([target.id]);
  let changed = true;
  while (changed) { // remove descendant replies
    changed = false;
    for (const c of all) if (!remove.has(c.id) && remove.has(c.parentId)) { remove.add(c.id); changed = true; }
  }
  db.comments = all.filter(c => !remove.has(c.id));
  writeDB(db);
  res.json({ ok: true, removed: remove.size });
});

app.post('/api/comments/:id/react', writeLimit, (req, res) => {
  const { userId, reaction } = req.body || {};
  const allowed = new Set(['like','love','haha','wow','sad','angry']);
  if (!userId || !allowed.has(reaction)) return res.status(400).json({ error: 'Invalid reaction' });
  const db = readDB();
  const comment = (db.comments || []).find(c => c.id === req.params.id);
  if (!comment) return res.status(404).json({ error: 'Not found' });
  comment.reactions = comment.reactions || {};
  comment.likes = comment.likes || [];
  const prev = comment.reactions[userId];
  if (prev === reaction) { delete comment.reactions[userId]; comment.likes = comment.likes.filter(id => id !== userId); }
  else {
    comment.reactions[userId] = reaction;
    if (!comment.likes.includes(userId)) comment.likes.push(userId);
  }
  writeDB(db);
  res.json(comment);
});

// Friends (Phase 5 base)
app.post('/api/friends/request', writeLimit, (req, res) => {
  const { fromId, toId } = req.body || {};
  if (!fromId || !toId || fromId === toId) return res.status(400).json({ error: 'Invalid request' });
  const db = readDB();
  const from = db.users.find(u => u.id === fromId);
  const to = db.users.find(u => u.id === toId);
  if (!from || !to) return res.status(404).json({ error: 'User not found' });
  if ((from.blockedUsers||[]).includes(toId) || (to.blockedUsers||[]).includes(fromId)) return res.status(403).json({ error: 'Blocked' });
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
app.post('/api/groups', writeLimit, (req, res) => {
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
app.get('/api/groups/:id/posts', (req, res) => {
  const db = readDB();
  const group = (db.groups || []).find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  const posts = [...(group.posts || [])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  res.json(posts);
});
app.post('/api/groups/:id/posts', (req, res) => {
  const { userId, content } = req.body || {};
  if (!userId || !content) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const group = (db.groups || []).find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  if (!(group.members || []).includes(userId)) return res.status(403).json({ error: 'Join group to post' });
  const post = { id: uid('gp'), groupId: group.id, userId, content: String(content).slice(0, 2000), createdAt: new Date().toISOString() };
  group.posts = group.posts || [];
  group.posts.push(post);
  writeDB(db);
  res.status(201).json(post);
});

// Messenger (Phase 6)
app.get('/api/messages', (req, res) => {
  const { userId } = req.query || {};
  const db = readDB();
  const msgs = (db.messages || []).filter(m => !userId || m.fromId === userId || m.toId === userId);
  res.json(msgs.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)));
});
app.post('/api/messages', writeLimit, (req, res) => {
  const { fromId, toId, content } = req.body || {};
  if (!fromId || !toId || !content) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const from = db.users.find(u => u.id === fromId);
  const to = db.users.find(u => u.id === toId);
  if (from && to && ((from.blockedUsers||[]).includes(toId) || (to.blockedUsers||[]).includes(fromId))) return res.status(403).json({ error: 'Blocked' });
  const msg = { id: uid('m'), fromId, toId, content: String(content).slice(0, 2000), createdAt: new Date().toISOString() };
  db.messages = db.messages || [];
  db.messages.push(msg);
  db.notifications = db.notifications || [];
  db.notifications.push({ id: uid('n'), userId: toId, type: 'message', actorId: fromId, read: false, createdAt: new Date().toISOString() });
  writeDB(db);
  res.status(201).json(msg);
});

// Stories (Phase 11/34)
app.get('/api/stories', (req, res) => {
  const db = readDB();
  const now = Date.now();
  const includeScheduled = req.query.includeScheduled === '1';
  const userId = req.query.userId;
  const changed = publishDueScheduled(db);
  if (changed) writeDB(db);
  const stories = (db.stories || []).filter(s => {
    if ((s.status || 'published') === 'scheduled') return includeScheduled && userId && s.userId === userId;
    return now - new Date(s.createdAt).getTime() < 24 * 60 * 60 * 1000;
  }).sort((a,b)=>new Date(b.createdAt || b.scheduledFor)-new Date(a.createdAt || a.scheduledFor));
  res.json(stories);
});
app.post('/api/stories', writeLimit, (req, res) => {
  const { userId, text, bg, scheduledFor } = req.body || {};
  if (!userId || !text) return res.status(400).json({ error: 'Missing fields' });
  let sched = null;
  if (scheduledFor) {
    const t = new Date(scheduledFor).getTime();
    if (!Number.isFinite(t) || t <= Date.now() + 30 * 1000) return res.status(400).json({ error: 'scheduledFor must be > 30s in future' });
    sched = new Date(t).toISOString();
  }
  const db = readDB();
  const story = { id: uid('s'), userId, text: String(text).slice(0, 180), bg: String(bg || '#1877f2').slice(0, 120), status: sched ? 'scheduled' : 'published', createdAt: sched ? null : new Date().toISOString(), ...(sched ? { scheduledFor: sched } : {}) };
  db.stories = db.stories || [];
  db.stories.push(story);
  writeDB(db);
  res.status(201).json(story);
});

// Marketplace (Phase 14)
app.get('/api/marketplace', (req, res) => {
  const db = readDB();
  res.json([...(db.marketplace || [])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
});
app.post('/api/marketplace', writeLimit, (req, res) => {
  const { userId, title, price, location, imageUrl } = req.body || {};
  if (!userId || !title || price === undefined || price === '') return res.status(400).json({ error: 'Missing fields' });
  const img = String(imageUrl || '').trim();
  if (img && !/^https?:\/\//i.test(img)) return res.status(400).json({ error: 'Image URL must start with http(s)://' });
  const db = readDB();
  const listing = { id: uid('mk'), userId, title: String(title).slice(0,120), price: String(price).slice(0,40), location: String(location||'').slice(0,80), imageUrl: img.slice(0,500), createdAt: new Date().toISOString() };
  db.marketplace = db.marketplace || [];
  db.marketplace.push(listing);
  writeDB(db);
  res.status(201).json(listing);
});

function sanitizeDB(input) {
  const base = { users: [], posts: [], comments: [], messages: [], conversations: [], groups: [], notifications: [], stories: [], marketplace: [], reports: [] };
  if (!input || typeof input !== 'object') return null;
  for (const k of Object.keys(base)) if (Array.isArray(input[k])) base[k] = input[k];
  return base;
}

// Data export/import mock (Phase 30)
app.get('/api/admin/export', (req, res) => {
  const db = readDB();
  const safe = JSON.parse(JSON.stringify(db));
  (safe.users || []).forEach(u => { if (u.password) u.password = '***'; });
  res.setHeader('Content-Disposition', 'attachment; filename="db-export.json"');
  res.json({ exportedAt: new Date().toISOString(), db: safe, counts: Object.fromEntries(Object.entries(safe).map(([k,v]) => [k, Array.isArray(v)?v.length:0])) });
});
app.get('/api/admin/diagnostics', (req, res) => {
  const db = readDB();
  res.json({
    time: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    node: process.version,
    counts: Object.fromEntries(Object.entries(db).map(([k,v]) => [k, Array.isArray(v)?v.length:0]))
  });
});
app.post('/api/admin/import', authLimit, (req, res) => {
  const { mode, db } = req.body || {};
  if (!['merge','replace'].includes(mode) || !db) return res.status(400).json({ error: 'Invalid import payload' });
  const incoming = sanitizeDB(db);
  if (!incoming) return res.status(400).json({ error: 'Invalid DB shape' });
  const size = Buffer.byteLength(JSON.stringify(incoming), 'utf8');
  if (size > 2 * 1024 * 1024) return res.status(413).json({ error: 'Import too large' });
  const current = readDB();
  let next = incoming;
  if (mode === 'merge') {
    next = { ...current };
    for (const k of Object.keys(incoming)) {
      if (!Array.isArray(incoming[k])) continue;
      const seen = new Set((next[k]||[]).map(x => x && x.id).filter(Boolean));
      next[k] = [...(next[k]||[]), ...incoming[k].filter(x => !(x && x.id && seen.has(x.id)))];
    }
  }
  writeDB(next);
  res.json({ ok: true, mode, counts: Object.fromEntries(Object.entries(next).map(([k,v]) => [k, Array.isArray(v)?v.length:0])) });
});

// Moderation stubs (Phase 22)
app.get('/api/reports', (req, res) => {
  const db = readDB();
  res.json([...(db.reports || [])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
});
app.post('/api/reports', writeLimit, (req, res) => {
  const { reporterId, targetType, targetId, reason } = req.body || {};
  if (!reporterId || !['post','comment'].includes(targetType) || !targetId) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const report = { id: uid('r'), reporterId, targetType, targetId, reason: String(reason||'Other').slice(0,200), status: 'open', createdAt: new Date().toISOString() };
  db.reports = db.reports || [];
  db.reports.push(report);
  writeDB(db);
  res.status(201).json(report);
});
app.post('/api/reports/:id/resolve', (req, res) => {
  const { status } = req.body || {};
  const db = readDB();
  const report = (db.reports || []).find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Not found' });
  report.status = status === 'dismissed' ? 'dismissed' : 'resolved';
  report.resolvedAt = new Date().toISOString();
  writeDB(db);
  res.json(report);
});

// Analytics/events stub (Phase 32)
app.post('/api/analytics/events', writeLimit, (req, res) => {
  const { type, userId, meta } = req.body || {};
  if (!type) return res.status(400).json({ error: 'Missing type' });
  const db = readDB();
  db.events = db.events || [];
  db.events.push({ id: uid('e'), type: String(type).slice(0, 60), userId: userId || null, meta: meta && typeof meta === 'object' ? meta : {}, createdAt: new Date().toISOString() });
  if (db.events.length > 1000) db.events = db.events.slice(-1000);
  writeDB(db);
  res.status(201).json({ ok: true });
});
app.get('/api/analytics/summary', (req, res) => {
  const db = readDB();
  const byType = {};
  (db.events || []).forEach(e => { byType[e.type] = (byType[e.type]||0)+1; });
  res.json({ total: (db.events||[]).length, byType });
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
