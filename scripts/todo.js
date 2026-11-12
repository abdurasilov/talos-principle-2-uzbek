const fs = require('fs');
const path = require('path');
const { readEntries } = require('./csv.js');

const root = path.resolve(__dirname, '..');
const [group = 'Game', prefix = '', out] = process.argv.slice(2);

const done = new Set();
for (const f of fs.readdirSync(path.join(root, 'tr')).filter(f => f.endsWith('.json') && f.includes(`_${group.toLowerCase()}_`))) {
  const { _prefix: p = '', ...data } = JSON.parse(fs.readFileSync(path.join(root, 'tr', f), 'utf8'));
  for (const k of Object.keys(data)) done.add(p + k);
}

const lines = readEntries(path.join(root, 'work', `${group}_en.csv`))
  .filter(e => e.key.startsWith(prefix) && !done.has(e.key) && e.source.trim() !== '')
  .map(e => `${e.key.slice(prefix.length)}\t${JSON.stringify(e.source)}`);

if (out) fs.writeFileSync(out, lines.join('\n') + '\n');
else console.log(lines.join('\n'));
console.error(`${lines.length} untranslated`);
