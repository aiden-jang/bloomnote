#!/usr/bin/env node
/**
 * Fail the build on a `var(--token)` whose token is never defined and which has no fallback.
 *
 * This exists because the same bug shipped twice, and both times it was invisible rather than
 * broken. CSS does not warn about an undefined custom property; it applies the "guaranteed
 * invalid" value and the property falls back to something plausible-looking:
 *
 *   - `--color-accent` (four call sites, all with a hardcoded magenta fallback) meant every
 *     standalone link in the app rendered in a colour reserved elsewhere for marking AI output.
 *   - `--pink-mid` / `--pink-deep` had no fallback, and `fill` is not inherited, so the wax seal
 *     on the time capsule fell through to the CSS initial value for fill, which is black. The
 *     centrepiece of that screen was a black dot with an invisible black glyph inside it.
 *   - `--text-deep` had no fallback either, but `color` IS inherited, so four rules quietly wore
 *     their parent's colour and looked close enough that nobody noticed for months.
 *
 * That last one is the reason this is a script and not a code review habit. The failure mode
 * scales with how inherited the property is, so the most common ones are the least visible.
 *
 * A reference WITH a fallback is allowed: that is a deliberate default, and `--scroll-y` (set
 * from JS at runtime) legitimately cannot be declared in CSS at all.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(ROOT).filter((f) => /\.(css|tsx?|jsx?)$/.test(f));

// Anything declared in a stylesheet, plus the locals React sets inline as style={{ ['--x']: … }}.
const defined = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/^\s*(--[\w-]+)\s*:/gm)) defined.add(m[1]);
  for (const m of src.matchAll(/\['(--[\w-]+)'\s* as string\]/g)) defined.add(m[1]);
  for (const m of src.matchAll(/'(--[\w-]+)':/g)) defined.add(m[1]);
}

const problems = [];
for (const f of files) {
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
        const [, name, fallback] = m;
        if (!defined.has(name) && !fallback) {
          problems.push(`${relative(process.cwd(), f)}:${i + 1}  var(${name})`);
        }
      }
    });
}

if (problems.length > 0) {
  console.error(
    `\n${problems.length} undefined CSS custom propert${problems.length === 1 ? 'y' : 'ies'} with no fallback.\n` +
      `Each one silently resolves to the property's initial value (black for fill, inherited for\n` +
      `color), so it renders as something wrong rather than failing.\n`,
  );
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\nDefine the token in index.css, or give the reference a fallback.\n`);
  process.exit(1);
}

console.log(`✓ ${defined.size} tokens defined, every var() reference resolves or has a fallback`);
