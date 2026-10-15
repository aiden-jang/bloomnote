import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'

const root = mkdtempSync(join(tmpdir(), 'bloomnote-docs-'))
const checker = fileURLToPath(new URL('./check-docs.mjs', import.meta.url))
mkdirSync(join(root, 'packages/web/src'), { recursive: true })
mkdirSync(join(root, 'scripts'))
mkdirSync(join(root, '.github'))
for (const name of ['ARCHITECTURE.md', 'DEPLOY.md', 'CONVENTIONS.md']) writeFileSync(join(root, name), '')
writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: {} }))
writeFileSync(join(root, 'packages/web/src/example.ts'), 'export const validSymbol = 1\n')
after(() => rmSync(root, { recursive: true, force: true }))

function check(readme, policy = '') {
  writeFileSync(join(root, 'README.md'), readme)
  writeFileSync(join(root, '.github/SECURITY.md'), policy)
  return spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8', timeout: 2000 })
}

test('documented symbols resolve against real source', () => {
  const result = check('Use validSymbol.\n')
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
})
test('unknown symbols fail the guard', () => {
  const result = check('Use missingSymbol.\n')
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /nothing named `missingSymbol`/)
})
test('GitHub policies are verified too', () => {
  const result = check('', 'Use missingPolicySymbol.\n')
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /\.github\/SECURITY\.md:1/)
})
test('almost-matching names cannot stall the check', () => {
  const result = check(`a${'Ab'.repeat(28)}_\n`)
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
})
test('checker tests cannot make a missing symbol resolve', () => {
  writeFileSync(join(root, 'scripts/fixture.test.mjs'), 'const missingSymbol = 1\n')
  const result = check('Use missingSymbol.\n')
  assert.equal(result.status, 1, result.stderr)
})

test('broken local documentation links fail', () => {
  const result = check('[Guide](missing-guide.md)\n')
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /broken local link/)
})
test('package directories are not mistaken for HTTP routes', () => {
  const result = check('Code lives in `packages/api/src/`.\n')
  assert.equal(result.status, 0, result.stderr)
})
