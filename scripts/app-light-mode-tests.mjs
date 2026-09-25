import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => {
  if (!condition) throw new Error(`app-theme-gate: ${message}`)
}

const layout = read('src/app/layout.tsx')
const account = read('src/app/account/page.tsx')
const toggle = read('src/components/ThemeToggle.tsx')

assert(layout.includes('data-theme="dark"'), 'root layout must render dark mode explicitly')
assert(layout.includes('themeColor: "#0A0A0A"'), 'browser chrome must use the dark BVS theme color')
assert(layout.includes('colorScheme: "dark"'), 'native controls must advertise dark color scheme only')
assert(!layout.includes('prefers-color-scheme'), 'OS light preference must not switch the site theme')
assert(!layout.includes('import "./light-premium.css";'), 'tabled light premium overrides must not ship')
assert(!layout.includes('import "./app-light-mode.css";'), 'tabled app light overrides must not ship')
assert(!layout.includes("localStorage.getItem('bvs_theme')"), 'saved legacy preference must not override dark mode')
assert(!account.includes("ThemeToggle"), 'Account Centre must not expose a theme toggle')
assert(!account.includes('Choose the BVS light or dark theme'), 'Account Centre must not advertise light mode')
assert(toggle.includes("dataset.theme = 'dark'"), 'legacy ThemeToggle must hard-lock dark mode if mounted')
assert(toggle.includes('return null'), 'legacy ThemeToggle must render no user-facing control')

console.log('app-theme-gate: dark-only ok')
