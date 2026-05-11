import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  ['node_modules/pdfjs-dist/cmaps', 'public/cmaps'],
  ['node_modules/pdfjs-dist/standard_fonts', 'public/standard_fonts'],
];

for (const [s, d] of targets) {
  const src = resolve(root, s);
  const dest = resolve(root, d);
  if (!existsSync(src)) {
    console.warn(`[copy-pdfjs-assets] skip (missing source): ${s}`);
    continue;
  }
  await rm(dest, { recursive: true, force: true });
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true });
  console.log(`[copy-pdfjs-assets] ${s} -> ${d}`);
}
