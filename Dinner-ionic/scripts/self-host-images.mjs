// One-off: downloads every remaining lh3.googleusercontent.com image
// (Google's prototype-hosting CDN -- an external dependency this app
// doesn't control) referenced directly in page templates, saves them under
// src/assets/images, and rewrites each template to point at the local copy
// instead. Run once with `node scripts/self-host-images.mjs`.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src', 'app');
const OUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'images');

const URL_RE = /https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_/=-]+/g;

await mkdir(OUT_DIR, { recursive: true });

const files = [];
for await (const entry of glob('**/*.page.html', { cwd: SRC })) {
  files.push(path.join(SRC, entry));
}

// Slug each unique URL by the page directory it first appears in (e.g.
// "login", or "future-features-2" for a page with several images), so
// filenames stay traceable back to where they're used.
const urlToSlug = new Map();
const usedSlugs = new Set();

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const uniqueUrlsInFile = [...new Set([...text.matchAll(URL_RE)].map((m) => m[0]))];
  const pageDir = path.basename(path.dirname(file));

  for (const url of uniqueUrlsInFile) {
    if (urlToSlug.has(url)) continue; // already claimed from an earlier file
    let n = 1;
    let slug = pageDir;
    while (usedSlugs.has(slug)) {
      n += 1;
      slug = `${pageDir}-${n}`;
    }
    usedSlugs.add(slug);
    urlToSlug.set(url, slug);
  }
}

console.log(`Found ${urlToSlug.size} unique image(s) across ${files.length} files.`);

const urlToLocalPath = new Map();
for (const [url, slug] of urlToSlug) {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`FAILED ${slug}: HTTP ${response.status} for ${url}`);
    continue;
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const filename = `${slug}.${ext}`;
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(OUT_DIR, filename), buffer);
  urlToLocalPath.set(url, `assets/images/${filename}`);
  console.log(`OK ${slug} -> ${filename} (${buffer.length} bytes)`);
}

let filesChanged = 0;
for (const file of files) {
  let text = await readFile(file, 'utf8');
  let changed = false;
  for (const [url, localPath] of urlToLocalPath) {
    if (text.includes(url)) {
      text = text.split(url).join(localPath);
      changed = true;
    }
  }
  if (changed) {
    await writeFile(file, text);
    filesChanged++;
  }
}

console.log(`\nRewrote ${filesChanged} template file(s).`);
