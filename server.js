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
    return { users: [], posts: [], comments: [], messages: [], conversations: [], groups: [], notifications: [] };
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
  const post = { id: uid('p'), userId, content, likes: [], createdAt: new Date().toISOString() };
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
  const idx = post.likes.indexOf(userId);
  if (idx >= 0) post.likes.splice(idx, 1); else post.likes.push(userId);
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
  writeDB(db);
  res.status(201).json(comment);
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
