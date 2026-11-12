const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = process.argv[2];
if (!version) { console.error('usage: node scripts/package.js <version>'); process.exit(1); }

const pakName = 'pakchunk99-Windows_UzbekLocalization_P.pak';
const dist = path.join(root, 'dist');
const dir = path.join(dist, `Talos2-Uzbek-${version}`);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

fs.copyFileSync(path.join(root, 'out', pakName), path.join(dir, pakName));
for (const f of ['install.bat', 'uninstall.bat']) {
  const text = fs.readFileSync(path.join(root, 'installer', f), 'utf8').replace(/\r?\n/g, '\r\n');
  fs.writeFileSync(path.join(dir, f), text);
}
fs.writeFileSync(path.join(dir, 'OQING.txt'), fs.readFileSync(path.join(root, 'installer', 'OQING.txt'), 'utf8').replace(/\r?\n/g, '\r\n'));

const zip = `${dir}.zip`;
fs.rmSync(zip, { force: true });
execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${dir}\\*' -DestinationPath '${zip}'`], { stdio: 'inherit' });
console.log(`built ${path.relative(root, zip)}`);
