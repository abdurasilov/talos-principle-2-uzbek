const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const baseDir = path.join(root, 'base');
const encFile = path.join(root, 'base.enc');
const keyFile = path.join(root, 'base.key');
const files = ['Game/Game.locmeta', 'Game/en/Game.locres', 'DLC/DLC.locmeta', 'DLC/en/DLC.locres'];

function passphrase() {
  const key = process.env.BASE_KEY || (fs.existsSync(keyFile) && fs.readFileSync(keyFile, 'utf8').trim());
  if (!key) { console.error('BASE_KEY env or base.key file required'); process.exit(1); }
  return key;
}

function pack() {
  const payload = Buffer.from(JSON.stringify(Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(baseDir, f)).toString('base64')]))));
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.scryptSync(passphrase(), salt, 32), iv);
  const data = Buffer.concat([cipher.update(payload), cipher.final()]);
  fs.writeFileSync(encFile, Buffer.concat([salt, iv, cipher.getAuthTag(), data]));
  console.log(`packed ${files.length} files into base.enc`);
}

function unpack() {
  const buf = fs.readFileSync(encFile);
  const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(passphrase(), buf.subarray(0, 16), 32), buf.subarray(16, 28));
  decipher.setAuthTag(buf.subarray(28, 44));
  const entries = JSON.parse(Buffer.concat([decipher.update(buf.subarray(44)), decipher.final()]).toString());
  for (const [f, b64] of Object.entries(entries)) {
    fs.mkdirSync(path.dirname(path.join(baseDir, f)), { recursive: true });
    fs.writeFileSync(path.join(baseDir, f), Buffer.from(b64, 'base64'));
  }
  console.log(`unpacked ${Object.keys(entries).length} files into base/`);
}

const commands = { pack, unpack };
const command = commands[process.argv[2]];
if (!command) { console.error('usage: node scripts/base.js <pack|unpack>'); process.exit(1); }
command();
