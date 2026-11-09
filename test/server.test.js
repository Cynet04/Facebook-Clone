const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

test('server module exports app and db helpers', () => {
  const { app, readDB, writeDB, DB_PATH } = require('../server');
  assert.equal(typeof app, 'function');
  assert.equal(typeof readDB, 'function');
  assert.equal(typeof writeDB, 'function');
  assert.ok(DB_PATH.endsWith(path.join('data', 'db.json')));
});

test('readDB returns object with core collections', () => {
  const { readDB } = require('../server');
  const db = readDB();
  assert.equal(typeof db, 'object');
  for (const k of ['users', 'posts', 'comments', 'messages', 'conversations', 'groups', 'notifications']) {
    assert.ok(Array.isArray(db[k]) || db[k] === undefined);
  }
});
