import fs from 'node:fs'

const path = 'src/components/layout/Navbar.tsx'
let source = fs.readFileSync(path, 'utf8')

if (!source.includes('href="/admin/copilot"')) {
  const desktopMarker = '              {premiumBadge && (\n'
  if (!source.includes(desktopMarker)) throw new Error('Desktop navbar marker not found; refusing broad rewrite.')
  source = source.replace(desktopMarker, '              {showEditorial && <Link href="/admin/copilot" className="px-2.5 py-2 text-sm text-text-secondary hover:text-brand transition-colors">Ops Copilot</Link>}\n' + desktopMarker)

  const mobileMarker = '                  {showEditorial && <Link href="/admin/creator-workflows"'
  if (!source.includes(mobileMarker)) throw new Error('Mobile navbar marker not found; refusing broad rewrite.')
  source = source.replace(mobileMarker, '                  {showEditorial && <Link href="/admin/copilot" className="py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}>Ops Copilot</Link>}\n' + mobileMarker)

  fs.writeFileSync(path, source)
  console.log('Inserted staff-only Ops Copilot navbar links.')
} else {
  console.log('Ops Copilot navbar links already present.')
}
