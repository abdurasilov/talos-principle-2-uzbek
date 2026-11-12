const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

let lastTag = '';
try { lastTag = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*'); } catch {}

const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const commits = git('log', range, '--format=%s%n%b%x1e').split('\x1e').map(c => c.trim()).filter(Boolean).map(c => {
  const [subject, ...body] = c.split('\n');
  return { subject, body: body.join('\n') };
});

const header = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/;
let bump = 0;
const changes = { feat: [], fix: [] };
for (const { subject, body } of commits) {
  const m = subject.match(header);
  if (!m) continue;
  const [, type, , breaking, description] = m;
  if (breaking || /^BREAKING[ -]CHANGE:/m.test(body)) bump = Math.max(bump, 3);
  else if (type === 'feat') bump = Math.max(bump, 2);
  else if (type === 'fix') bump = Math.max(bump, 1);
  if (type in changes) changes[type].push(description);
}

let version = '';
if (bump) {
  const [major, minor, patch] = (lastTag ? lastTag.slice(1) : '0.0.0').split('.').map(Number);
  version = 'v' + (bump === 3 ? [major + 1, 0, 0] : bump === 2 ? [major, minor + 1, 0] : [major, minor, patch + 1]).join('.');

  const sections = [['Yangi', changes.feat], ['Tuzatildi', changes.fix]].filter(([, list]) => list.length);
  const notes = fs.readFileSync(path.join(root, '.github/release-notes.md'), 'utf8').trimEnd() + (sections.length ? '\n\n## Oʻzgarishlar\n\n' + sections.map(([title, list]) => `**${title}:**\n${list.map(d => `- ${d}`).join('\n')}`).join('\n\n') : '') + '\n';
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/release-notes.md'), notes);
}

console.log(version ? `${lastTag || 'none'} -> ${version}` : `no feat/fix commits since ${lastTag || 'start'}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
