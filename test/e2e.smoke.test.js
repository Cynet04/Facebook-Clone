const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
const checks = [
  ['main content anchor', index, /id="mainContent"/],
  ['global search', index, /id="globalSearch"/],
  ['composer', index, /id="postInput"/],
  ['stories rail', index, /id="storiesRail"/],
  ['messenger overlay', index, /id="messengerOverlay"/],
  ['settings view', index, /id="settingsView"/],
  ['moderation view', index, /id="moderationView"/],
  ['service worker registration hook', appJs, /sw\.js|serviceWorker/],
  ['health/API markers in server', fs.readFileSync(path.join(root, 'server.js'), 'utf8'), /\/api\/health/]
];
let failed = 0;
for (const [name, src, re] of checks) {
  if (re.test(src)) console.log('PASS:', name);
  else { console.error('FAIL:', name); failed++; }
}
if (failed) process.exit(1);
console.log('Frontend/API shell smoke checks passed.');
