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
  const { name, avatar, cover, bio, work, education, location, relationship, website, about } = req.body || {};
  const set = (k, v, n=200) => { if (v !== undefined) user[k] = String(v).slice(0, n); };
  set('name', name, 80); set('avatar', avatar, 500); set('cover', cover, 500); set('bio', bio, 280);
  set('work', work, 120); set('education', education, 120); set('location', location, 120);
  set('relationship', relationship, 80); set('website', website, 200); set('about', about, 1000);
  writeDB(db);
  const { password, ...safe } = user;
  safe.savedPosts = safe.savedPosts || [];
  res.json(safe);
});
app.get('/api/users/:id/suggestions', (req, res) => {
  const db = readDB();
  const me = db.users.find(u => u.id === req.params.id);
  if (!me) return res.status(404).json({ error: 'Not found' });
  const myFriends = new Set(me.friends || []);
  const blocked = new Set([...(me.blockedUsers || []), ...db.users.filter(u => (u.blockedUsers||[]).includes(me.id)).map(u => u.id)]);
  const exclude = new Set([me.id, ...myFriends, ...(me.friendRequests || []), ...blocked]);
  const suggestions = db.users.filter(u => !exclude.has(u.id)).map(u => {
    const mutual = (u.friends || []).filter(id => myFriends.has(id));
    return { id: u.id, name: u.name, avatar: u.avatar || '', mutualCount: mutual.length, mutualIds: mutual.slice(0,3), reason: mutual.length ? `${mutual.length} mutual friend${mutual.length>1?'s':''}` : 'Suggested for you' };
  }).sort((a,b)=>b.mutualCount-a.mutualCount || a.name.localeCompare(b.name)).slice(0,12);
  res.json(suggestions);
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
  const { userId, content, imageUrl, scheduledFor, poll } = req.body || {};
  if (!userId || !content) return res.status(400).json({ error: 'Missing fields' });
  const img = String(imageUrl || '').trim();
  if (img && !/^https?:\/\//i.test(img)) return res.status(400).json({ error: 'Image URL must start with http(s)://' });
  let sched = null;
  if (scheduledFor) {
    const t = new Date(scheduledFor).getTime();
    if (!Number.isFinite(t) || t <= Date.now() + 30 * 1000) return res.status(400).json({ error: 'scheduledFor must be > 30s in future' });
    sched = new Date(t).toISOString();
  }
  let pollData = null;
  if (poll && Array.isArray(poll.options)) {
    const options = poll.options.map(o => String(o||'').trim()).filter(Boolean).slice(0,4);
    if (options.length >= 2) pollData = { question: String(poll.question || content).slice(0,200), options: options.map(t => ({ id: uid('po'), text: t.slice(0,80), votes: [] })) };
  }
  const db = readDB();
  const post = { id: uid('p'), userId, content: String(content).slice(0, 5000), imageUrl: img.slice(0, 500), likes: [], reactions: {}, shares: 0, ...(pollData ? { poll: pollData } : {}), status: sched ? 'scheduled' : 'published', createdAt: sched ? null : new Date().toISOString(), ...(sched ? { scheduledFor: sched } : {}) };
  db.posts = db.posts || [];
  db.posts.push(post);
  writeDB(db);
  res.status(201).json(post);
});
app.post('/api/posts/:id/poll/vote', writeLimit, (req, res) => {
  const { userId, optionId } = req.body || {};
  if (!userId || !optionId) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const post = (db.posts || []).find(p => p.id === req.params.id);
  if (!post || !post.poll) return res.status(404).json({ error: 'Poll not found' });
  post.poll.options.forEach(o => { o.votes = (o.votes || []).filter(id => id !== userId); });
  const opt = post.poll.options.find(o => o.id === optionId);
  if (!opt) return res.status(400).json({ error: 'Invalid option' });
  opt.votes.push(userId);
  writeDB(db);
  res.json(post.poll);
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

// ---------- Events stub (Phase 44; eventItems avoids analytics db.events) ----------
app.get('/api/events', (req, res) => { const db = readDB(); res.json((db.eventItems || []).slice().sort((a,b)=>new Date(a.date||0)-new Date(b.date||0))); });
app.post('/api/events', writeLimit, (req, res) => {
  const { userId, title, date, location, description } = req.body || {};
  if (!userId || !String(title||'').trim() || !date) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const ev = { id: uid('se'), title: String(title).slice(0,120), date: new Date(date).toISOString(), location: String(location||'').slice(0,120), description: String(description||'').slice(0,500), hostUserId: userId, rsvps: [], createdAt: new Date().toISOString() };
  db.eventItems = db.eventItems || []; db.eventItems.push(ev); writeDB(db); res.status(201).json(ev);
});
app.post('/api/events/:id/rsvp', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const ev = (db.eventItems || []).find(x => x.id === req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  ev.rsvps = ev.rsvps || []; const i = ev.rsvps.indexOf(userId); if (i >= 0) ev.rsvps.splice(i,1); else ev.rsvps.push(userId);
  writeDB(db); res.json(ev);
});

// ---------- Fundraisers stub (Phase 46) ----------
app.get('/api/fundraisers', (req, res) => { const db = readDB(); res.json((db.fundraisers || []).slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))); });
app.post('/api/fundraisers', writeLimit, (req, res) => {
  const { userId, title, goal, description } = req.body || {};
  if (!userId || !String(title||'').trim()) return res.status(400).json({ error: 'Missing fields' });
  const g = Math.max(1, Math.min(1000000, Number(goal)||100));
  const db = readDB();
  const fr = { id: uid('fr'), title: String(title).slice(0,120), goal: g, raised: 0, organizerUserId: userId, description: String(description||'').slice(0,500), donors: [], createdAt: new Date().toISOString() };
  db.fundraisers = db.fundraisers || []; db.fundraisers.push(fr); writeDB(db); res.status(201).json(fr);
});
app.post('/api/fundraisers/:id/donate', writeLimit, (req, res) => {
  const { userId, amount } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const amt = Math.max(1, Math.min(10000, Number(amount)||5));
  const db = readDB();
  const fr = (db.fundraisers || []).find(x => x.id === req.params.id);
  if (!fr) return res.status(404).json({ error: 'Fundraiser not found' });
  fr.raised = Number(fr.raised||0) + amt;
  fr.donors = fr.donors || []; fr.donors.push({ userId, amount: amt, createdAt: new Date().toISOString() });
  writeDB(db); res.json(fr);
});

// ---------- Pages stub (Phase 47) ----------
app.get('/api/pages', (req, res) => { const db = readDB(); res.json((db.pages || []).slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))); });
app.post('/api/pages', writeLimit, (req, res) => {
  const { userId, name, category, description } = req.body || {};
  if (!userId || !String(name||'').trim()) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const pg = { id: uid('pg'), name: String(name).slice(0,120), category: String(category||'General').slice(0,60), description: String(description||'').slice(0,500), ownerUserId: userId, likes: [], createdAt: new Date().toISOString() };
  db.pages = db.pages || []; db.pages.push(pg); writeDB(db); res.status(201).json(pg);
});
app.post('/api/pages/:id/like', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const pg = (db.pages || []).find(x => x.id === req.params.id);
  if (!pg) return res.status(404).json({ error: 'Page not found' });
  pg.likes = pg.likes || []; const i = pg.likes.indexOf(userId); if (i >= 0) pg.likes.splice(i,1); else pg.likes.push(userId);
  writeDB(db); res.json(pg);
});

// ---------- Climate/Science Center stub (Phase 53) ----------
app.get('/api/science', (req, res) => { const db = readDB(); res.json((db.sciencePosts || []).slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))); });
app.post('/api/science', writeLimit, (req, res) => {
  const { userId, title, content, category, imageUrl } = req.body || {};
  if (!userId || !String(title||'').trim()) return res.status(400).json({ error: 'Missing fields' });
  const img = String(imageUrl || '').trim();
  if (img && !/^https?:\/\//i.test(img)) return res.status(400).json({ error: 'Image URL must start with http(s)://' });
  const db = readDB();
  const p = { id: uid('sc'), title: String(title).slice(0,120), content: String(content||'').slice(0,2000), category: String(category||'General').slice(0,60), imageUrl: img.slice(0,500), authorUserId: userId, likes: [], shares: 0, createdAt: new Date().toISOString() };
  db.sciencePosts = db.sciencePosts || []; db.sciencePosts.push(p); writeDB(db); res.status(201).json(p);
});
app.post('/api/science/:id/react', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const p = (db.sciencePosts || []).find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Article not found' });
  p.likes = p.likes || []; const i = p.likes.indexOf(userId); if (i >= 0) p.likes.splice(i,1); else p.likes.push(userId);
  writeDB(db); res.json(p);
});
app.post('/api/science/:id/share', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const p = (db.sciencePosts || []).find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Article not found' });
  p.shares = Number(p.shares||0) + 1;
  writeDB(db); res.json(p);
});

// ---------- Ad Center stub (Phase 52) ----------
app.get('/api/ads', (req, res) => { const db = readDB(); res.json((db.ads || []).slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))); });
app.post('/api/ads', writeLimit, (req, res) => {
  const { userId, name, targeting, budget } = req.body || {};
  if (!userId || !String(name||'').trim()) return res.status(400).json({ error: 'Missing fields' });
  const b = Math.max(1, Math.min(1000000, Number(budget)||100));
  const db = readDB();
  const ad = { id: uid('ad'), name: String(name).slice(0,120), targeting: String(targeting||'').slice(0,200), budget: b, spent: 0, impressions: 0, clicks: 0, status: 'active', advertiserUserId: userId, createdAt: new Date().toISOString() };
  db.ads = db.ads || []; db.ads.push(ad); writeDB(db); res.status(201).json(ad);
});
app.post('/api/ads/:id/pause', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const ad = (db.ads || []).find(x => x.id === req.params.id);
  if (!ad) return res.status(404).json({ error: 'Ad not found' });
  if (ad.advertiserUserId !== userId) return res.status(403).json({ error: 'Not allowed' });
  ad.status = ad.status === 'paused' ? 'active' : 'paused';
  writeDB(db); res.json(ad);
});

// ---------- Jobs stub (Phase 51) ----------
app.get('/api/jobs', (req, res) => { const db = readDB(); res.json((db.jobs || []).slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))); });
app.post('/api/jobs', writeLimit, (req, res) => {
  const { userId, title, company, location, type, salary, description } = req.body || {};
  if (!userId || !String(title||'').trim()) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const j = { id: uid('jb'), title: String(title).slice(0,120), company: String(company||'').slice(0,120), location: String(location||'').slice(0,120), type: String(type||'Full-time').slice(0,40), salary: String(salary||'').slice(0,60), description: String(description||'').slice(0,500), posterUserId: userId, applications: [], savedBy: [], createdAt: new Date().toISOString() };
  db.jobs = db.jobs || []; db.jobs.push(j); writeDB(db); res.status(201).json(j);
});
app.post('/api/jobs/:id/apply', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const job = (db.jobs || []).find(x => x.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.applications = job.applications || []; if (!job.applications.includes(userId)) job.applications.push(userId);
  writeDB(db); res.json(job);
});
app.post('/api/jobs/:id/save', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const job = (db.jobs || []).find(x => x.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.savedBy = job.savedBy || []; const i = job.savedBy.indexOf(userId); if (i >= 0) job.savedBy.splice(i,1); else job.savedBy.push(userId);
  writeDB(db); res.json(job);
});

// ---------- Gaming stub (Phase 50) ----------
app.get('/api/games', (req, res) => { const db = readDB(); res.json((db.games || []).slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))); });
app.post('/api/games/:id/react', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const g = (db.games || []).find(x => x.id === req.params.id);
  if (!g) return res.status(404).json({ error: 'Game not found' });
  g.likes = g.likes || []; const i = g.likes.indexOf(userId); if (i >= 0) g.likes.splice(i,1); else g.likes.push(userId);
  writeDB(db); res.json(g);
});
app.post('/api/games/:id/play', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const g = (db.games || []).find(x => x.id === req.params.id);
  if (!g) return res.status(404).json({ error: 'Game not found' });
  g.plays = Number(g.plays||0) + 1;
  writeDB(db); res.json(g);
});

// ---------- Reels stub (Phase 49) ----------
app.get('/api/reels', (req, res) => { const db = readDB(); res.json((db.reels || []).slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))); });
app.post('/api/reels/:id/react', writeLimit, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const db = readDB();
  const r = (db.reels || []).find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Reel not found' });
  r.likes = r.likes || []; const i = r.likes.indexOf(userId); if (i >= 0) r.likes.splice(i,1); else r.likes.push(userId);
  writeDB(db); res.json(r);
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
