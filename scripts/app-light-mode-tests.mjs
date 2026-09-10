import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => {
  if (!condition) throw new Error(`app-light-mode: ${message}`)
}

const layout = read('src/app/layout.tsx')
const css = read('src/app/app-light-mode.css')
const home = read('src/app/app/[surface]/page.tsx')

assert(layout.includes('import "./app-light-mode.css";'), 'root layout must load contained-app light overrides')
assert(css.includes(':root[data-theme="light"][data-bvs-app-shell="true"]'), 'light overrides must be scoped to the contained app shell')
assert(css.includes('[data-bvs-header]'), 'native top bar needs an explicit light surface')
assert(css.includes('.bvs-app-home-hero'), 'home hero needs a semantic light-mode surface')
assert(home.includes('bvs-app-home-hero'), 'home hero must opt in to the semantic light treatment')
assert(css.includes('.bvs-app-feed-entry'), 'home Feed entry must remain readable in light mode')
assert(home.includes('bvs-app-feed-entry'), 'home Feed entry must opt in to its light treatment')
assert(css.includes('.bvs-app-bottom-nav a[aria-current="page"]'), 'active native tab needs explicit light-mode contrast')
assert(css.includes('.bvs-persistent-player'), 'persistent player metadata needs a light-mode contrast rule')
assert(css.includes('[class~="text-white/82"]'), 'high-opacity dark-first text utilities must be remapped')
assert(css.includes('[data-now-playing-shell="true"]'), 'immersive Now Playing must retain an intentional dark color scheme')
assert(!css.includes(':root[data-theme="dark"][data-bvs-app-shell="true"]'), 'light fix must not rewrite the dark theme')

console.log('app-light-mode: ok')
