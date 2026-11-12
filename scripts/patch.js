const fs = require('fs');
const path = require('path');

const [patchFile] = process.argv.slice(2);
const patch = JSON.parse(fs.readFileSync(patchFile, 'utf8'));
const dir = path.join(__dirname, '../tr');
const pending = new Set(Object.keys(patch).filter(k => k !== '_prefix'));

for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const file = path.join(dir, f);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = false;
  for (const k of Object.keys(data)) {
    if (k === '_prefix') continue;
    if (!(k in patch)) continue;
    if (patch[k] === null) delete data[k]; else data[k] = patch[k];
    pending.delete(k);
    changed = true;
  }
  if (changed) fs.writeFileSync(file, '{\n' + Object.entries(data).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n}\n');
}
if (pending.size) console.warn('not found:', [...pending].join(', '));
console.log(`patched ${Object.keys(patch).length - pending.size} keys`);
