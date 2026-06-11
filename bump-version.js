// bump-version.js
// Usage: node bump-version.js 20260113-1
// (If no version passed, uses YYYYMMDD-HHMM)

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const versionArg = process.argv[2];

function pad(n) { return String(n).padStart(2, "0"); }
function defaultVersion() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const VERSION = versionArg || defaultVersion();

function isExternal(url) {
  return /^https?:\/\//i.test(url) || /^\/\//.test(url);
}

function isCssOrJs(url) {
  return /\.(css|js)(\?|#|$)/i.test(url);
}

// Accept: css/, /css/, ./css/, js/, /js/, ./js/
function isTargetLocal(url) {
  const u = url.toLowerCase();
  return (
    u.startsWith("css/") || u.startsWith("/css/") || u.startsWith("./css/") ||
    u.startsWith("js/")  || u.startsWith("/js/")  || u.startsWith("./js/")
  );
}

function bumpUrl(url) {
  if (!url) return url;
  if (isExternal(url)) return url;
  if (!isCssOrJs(url)) return url;
  if (!isTargetLocal(url)) return url;

  // keep hash
  const [beforeHash, hash = ""] = url.split("#");
  const hashPart = hash ? `#${hash}` : "";

  // query
  const [base, query = ""] = beforeHash.split("?");
  const params = new URLSearchParams(query);
  params.set("v", VERSION);

  return `${base}?${params.toString()}${hashPart}`;
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".html")) out.push(full);
  }
  return out;
}

const files = walk(root);
let changed = 0;

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");

  const updated = original.replace(
    /\b(href|src)\s*=\s*(['"])([^'"]+)\2/gi,
    (m, attr, quote, url) => `${attr}=${quote}${bumpUrl(url)}${quote}`
  );

  if (updated !== original) {
    fs.writeFileSync(file, updated, "utf8");
    changed++;
    console.log(`✔ ${path.relative(root, file)}`);
  }
}

console.log(`\nDone. v=${VERSION} | changed ${changed}/${files.length} HTML files`);
