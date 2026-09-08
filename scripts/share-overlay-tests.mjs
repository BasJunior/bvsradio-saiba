import fs from 'node:fs'

const share = fs.readFileSync(new URL('../src/components/app-vnext/AppShareButton.tsx', import.meta.url), 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(share.includes('createPortal'), 'share UI must render through a document-level portal')
assert(share.includes('document.body'), 'share portal must mount outside the animated app content stack')
assert(share.includes('z-[1000]'), 'share layer must sit above the persistent player and bottom navigation')
assert(share.includes('max-h-[92dvh]'), 'share sheet must remain visible within the iPhone viewport')
assert(share.includes('env(safe-area-inset-bottom)'), 'share sheet must respect the iPhone bottom safe area')
assert(share.includes('setOpen(false);\n      await nextPaint();'), 'BVS overlay must dismiss before the native system share sheet opens')
assert(share.includes('navigator.canShare?.({ files: [storyCard] })'), 'story-card sharing must remain progressive-enhancement only')
assert(share.includes('await shareBvs({ title:'), 'share must fall back to the normal system/link share path')

console.log('Share overlay assertions passed.')
