const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readEntries, stringify } = require('./csv.js');

const root = path.resolve(__dirname, '..');
const tools = path.join(root, 'tools');
const locDir = path.join(root, 'base');
const stage = path.join(root, 'stage');
const out = path.join(root, 'out');
const cultureArg = process.argv.find(a => a.startsWith('--culture='));
const targetCulture = cultureArg ? cultureArg.slice('--culture='.length) : 'uz';
const asciiGlyphs = process.argv.includes('--ascii-glyphs');

// Fallback for fonts without U+02BB/U+02BC: typographic quotes exist in nearly every font.
const glyphMap = asciiGlyphs ? [[/ʻ/g, '‘'], [/ʼ/g, '’']] : [];

const tokenRe = /\{[^}]*\}|<[^>]*>|%w\d+|\r\n|\n|⏯/g;

function tokens(s) {
  return (s.match(tokenRe) || []).sort().join('|');
}

function loadTranslations(group) {
  const dir = path.join(root, 'tr');
  const map = new Map();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && f.includes(`_${group.toLowerCase()}_`)).sort()) {
    const { _prefix: prefix = '', ...data } = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [shortKey, v] of Object.entries(data)) {
      const k = prefix + shortKey;
      if (map.has(k) && map.get(k).value !== v) console.warn(`[${group}] ${k}: overridden in ${f}`);
      map.set(k, { value: v, file: f });
    }
  }
  return map;
}

// Layout: 16-byte magic GUID, 1-byte version, FString native culture, FString native locres path, TArray<FString> compiled cultures.
function readFString(buf, pos) {
  const len = buf.readInt32LE(pos);
  return { value: buf.toString('latin1', pos + 4, pos + 4 + len - 1), next: pos + 4 + len };
}

function writeFString(s) {
  const b = Buffer.alloc(4 + s.length + 1);
  b.writeInt32LE(s.length + 1, 0);
  b.write(s, 4, 'latin1');
  return b;
}

function addCultureToLocmeta(src, dest, culture) {
  const buf = fs.readFileSync(src);
  let pos = 17;
  const native = readFString(buf, pos);
  const nativeLocres = readFString(buf, native.next);
  pos = nativeLocres.next;
  const count = buf.readInt32LE(pos);
  pos += 4;
  const cultures = [];
  for (let i = 0; i < count; i++) {
    const s = readFString(buf, pos);
    cultures.push(s.value);
    pos = s.next;
  }
  if (cultures.includes(culture)) return false;
  cultures.push(culture);
  cultures.sort();
  const countBuf = Buffer.alloc(4);
  countBuf.writeInt32LE(cultures.length, 0);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.concat([buf.subarray(0, nativeLocres.next), countBuf, ...cultures.map(writeFString)]));
  return true;
}

let errors = 0;
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const group of ['Game', 'DLC']) {
  const sourceCsv = path.join(root, `work/${group}_en.csv`);
  fs.mkdirSync(path.dirname(sourceCsv), { recursive: true });
  execFileSync(path.join(tools, 'UnrealLocres.exe'), ['export', path.join(locDir, `${group}/en/${group}.locres`), '-f', 'csv', '-o', sourceCsv], { stdio: 'pipe' });
  const entries = readEntries(sourceCsv);
  const byKey = new Map(entries.map(e => [e.key, e]));
  const tr = loadTranslations(group);
  let applied = 0;

  for (const [key, { value, file }] of tr) {
    const entry = byKey.get(key);
    if (!entry) { console.error(`[${group}] unknown key ${key} (${file})`); errors++; continue; }
    if (tokens(entry.source) !== tokens(value)) {
      console.error(`[${group}] token mismatch ${key} (${file})\n  en: ${tokens(entry.source)}\n  uz: ${tokens(value)}`);
      errors++;
      continue;
    }
    if (/[A-Za-zʻ]'[A-Za-z]/.test(value)) { console.error(`[${group}] ASCII apostrophe in ${key} (${file}); use ʻ (oʻ, gʻ) or ʼ (tutuq)`); errors++; continue; }
    if (/[Ѐ-ӿ]/.test(value)) { console.error(`[${group}] Cyrillic character in ${key} (${file})`); errors++; continue; }
    let text = value;
    for (const [re, rep] of glyphMap) text = text.replace(re, rep);
    entry.target = text;
    applied++;
  }

  const csvPath = path.join(out, `${group}_uz.csv`);
  fs.writeFileSync(csvPath, stringify([['key', 'source', 'target'], ...entries.map(e => [e.key, e.source, e.target])]));

  const dest = path.join(stage, `Talos2/Content/Localization/${group}/${targetCulture}/${group}.locres`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync(path.join(tools, 'UnrealLocres.exe'), ['import', path.join(locDir, `${group}/en/${group}.locres`), csvPath, '-f', 'csv', '-o', dest], { stdio: 'pipe' });
  const locmeta = `Talos2/Content/Localization/${group}/${group}.locmeta`;
  addCultureToLocmeta(path.join(locDir, `${group}/${group}.locmeta`), path.join(stage, locmeta), targetCulture);
  console.log(`${group}: ${applied}/${entries.length} strings translated (${(100 * applied / entries.length).toFixed(1)}%)`);
}

if (errors) { console.error(`${errors} error(s); pak not built`); process.exit(1); }

const pakName = 'pakchunk99-Windows_UzbekLocalization_P.pak';
execFileSync(path.join(tools, 'repak.exe'), ['pack', '--version', 'V11', '-m', '../../../', '-q', stage, path.join(out, pakName)], { stdio: 'inherit' });
console.log(`built out/${pakName}`);
