// Copies the built plugin artifacts (main.js, styles.css, manifest.json)
// into one or more Obsidian plugin folders so vaults can run the latest
// local build without symlinking the repo. Targets are listed in a
// git-ignored `deploy-targets.json` at the repo root.
//
//   node scripts/deploy-plugin.mjs            # push to configured targets
//   npm run deploy                            # build first, then push
//
// Each target line is the absolute path to the destination *plugin folder*
// (…/.obsidian/plugins/bible-study). The folder is created if missing.
// A `.hotreload` marker is written into each target so vaults running the
// Hot-Reload plugin pick up the new files automatically; otherwise reload
// the plugin (or Obsidian) once after a push.

import { existsSync, lstatSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = ['main.js', 'styles.css', 'manifest.json']
const CONFIG_FILE = join(repoRoot, 'deploy-targets.json')

function readConfiguredTargets() {
  if (!existsSync(CONFIG_FILE)) return []
  let parsed
  try {
    parsed = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
  } catch (err) {
    console.error(`✖ Could not parse ${CONFIG_FILE}: ${err.message}`)
    process.exit(1)
  }
  if (!Array.isArray(parsed)) {
    console.error(`✖ ${CONFIG_FILE} must be a JSON array of plugin-folder paths.`)
    process.exit(1)
  }
  // Allow plain strings or { path } objects, and skip blanks / comments
  // (a leading "//" string is treated as a comment so the file can be
  // self-documenting).
  return parsed
    .map((entry) => (typeof entry === 'string' ? entry : entry?.path))
    .filter((p) => typeof p === 'string' && p.trim() && !p.trim().startsWith('//'))
    .map((p) => p.trim())
}

function ensureBuilt() {
  const missing = ASSETS.filter((a) => !existsSync(join(repoRoot, a)))
  if (missing.length) {
    console.error(
      `✖ Missing build artifact(s): ${missing.join(', ')}.\n` +
        '  Run `npm run build` first, or use `npm run deploy` (build + push).'
    )
    process.exit(1)
  }
}

function pushTo(target, label) {
  // Never write through a symlink — that would dump files into the
  // symlink's target (e.g. the repo itself). Tell the user to replace it
  // with a real folder.
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    console.warn(
      `⚠ Skipping ${label} — it is a symlink.\n` +
        `  Replace the symlink with a real folder to deploy a copy:\n` +
        `    rm "${target}" && mkdir -p "${target}"`
    )
    return false
  }
  mkdirSync(target, { recursive: true })
  for (const asset of ASSETS) {
    copyFileSync(join(repoRoot, asset), join(target, asset))
  }
  // Marker for the Hot-Reload plugin; harmless where it isn't installed.
  const hotreload = join(target, '.hotreload')
  if (!existsSync(hotreload)) writeFileSync(hotreload, '')
  console.log(`✔ ${label}\n    ${target}`)
  return true
}

ensureBuilt()

const targets = readConfiguredTargets().map((path) => ({
  path,
  label: 'configured target',
}))

if (!targets.length) {
  console.error(
    '✖ No deploy targets configured.\n' +
      '  Copy deploy-targets.example.json to deploy-targets.json and list\n' +
      '  the plugin folders to push to.'
  )
  process.exit(1)
}

console.log(`Deploying ${ASSETS.join(', ')} →`)
let pushed = 0
for (const { path, label } of targets) {
  if (pushTo(path, label)) pushed++
}
console.log(`\nDone. Pushed to ${pushed} of ${targets.length} target(s).`)
