import fs from 'node:fs'

const navbarPath = 'src/components/layout/Navbar.tsx'
let navbar = fs.readFileSync(navbarPath, 'utf8')

if (!navbar.includes('href="/admin/copilot"')) {
  const desktopMarker = '              {premiumBadge && (\n'
  if (!navbar.includes(desktopMarker)) throw new Error('Desktop navbar marker not found; refusing broad rewrite.')
  navbar = navbar.replace(desktopMarker, '              {showEditorial && <Link href="/admin/copilot" className="px-2.5 py-2 text-sm text-text-secondary hover:text-brand transition-colors">Ops Copilot</Link>}\n' + desktopMarker)

  const mobileMarker = '                  {showEditorial && <Link href="/admin/creator-workflows"'
  if (!navbar.includes(mobileMarker)) throw new Error('Mobile navbar marker not found; refusing broad rewrite.')
  navbar = navbar.replace(mobileMarker, '                  {showEditorial && <Link href="/admin/copilot" className="py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}>Ops Copilot</Link>}\n' + mobileMarker)

  fs.writeFileSync(navbarPath, navbar)
  console.log('Inserted staff-only Ops Copilot navbar links.')
} else {
  console.log('Ops Copilot navbar links already present.')
}

const toolsPath = 'src/lib/staff-copilot/tools.ts'
let tools = fs.readFileSync(toolsPath, 'utf8')
const unsafeSelect = 'provider_status,amount,currency,verified,reconciled,reconciliation_error,received_at'
const safeSelect = 'provider_status,amount,currency,verified,reconciled,received_at'
if (tools.includes(unsafeSelect)) {
  tools = tools.replace(unsafeSelect, safeSelect)
  fs.writeFileSync(toolsPath, tools)
  console.log('Removed raw reconciliation_error from staff order lookup.')
} else if (tools.includes('reconciliation_error')) {
  throw new Error('Unexpected reconciliation_error occurrence; refusing broad rewrite.')
} else {
  console.log('Staff order lookup already excludes raw reconciliation errors.')
}

const testsPath = 'scripts/staff-copilot-tests.mjs'
let tests = fs.readFileSync(testsPath, 'utf8')
const assertion = "assert.doesNotMatch(toolsSource, /reconciliation_error/, 'raw reconciliation errors must never be selected for copilot output')\n"
if (!tests.includes(assertion)) {
  const marker = "assert.doesNotMatch(toolsSource, /child_process|execSync|spawn\\(|\\brpc\\/.*sql|vercel deploy|force[_-]?live/i, 'read tool implementation must not contain shell/sql/deploy/force-live capabilities')\n"
  if (!tests.includes(marker)) throw new Error('Staff Copilot test marker missing; refusing broad rewrite.')
  tests = tests.replace(marker, marker + assertion)
  fs.writeFileSync(testsPath, tests)
  console.log('Locked raw-error exclusion into staff copilot tests.')
}
