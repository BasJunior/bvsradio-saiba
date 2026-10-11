'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type Section = { id: string; label: string; accent?: string | null }
const EditorialWorkspaceContext = createContext<{ active: string; visited: string[] } | null>(null)
export function useEditorialWorkspaceSection() { return useContext(EditorialWorkspaceContext) }

/** Keep review queues one tap away without stacking every operations panel. */
export default function EditorialWorkspace({ sections, initialSection, children }: {
  sections: Section[]; initialSection: string; children: ReactNode
}) {
  const [workspace, setWorkspace] = useState({ active: initialSection, visited: [initialSection] })
  const active = workspace.active
  const root = useRef<HTMLDivElement>(null)
  const sectionIds = sections.map(section => section.id).join('|')
  useEffect(() => {
    const sync = () => {
      const requested = window.location.hash.slice(1)
      const id = requested === 'ed-programmes' ? 'ed-artists' : requested
      if (sectionIds.split('|').includes(id)) setWorkspace(previous => ({ active: id, visited: previous.visited.includes(id) ? previous.visited : [...previous.visited, id] }))
    }
    sync()
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [sectionIds])

  return <EditorialWorkspaceContext.Provider value={workspace}>
    <div ref={root} className="mt-5 scroll-mt-24" data-editorial-workspace>
      <div className="sticky top-16 z-30 border-y border-white/15 bg-bg-primary px-3 py-3" data-editorial-workspace-nav>
        <label htmlFor="editorial-workspace" className="mb-1 block text-[11px] uppercase tracking-[.18em] text-text-secondary">Workspace</label>
        <select id="editorial-workspace" value={active} onChange={event => {
          const id = event.target.value
          setWorkspace(previous => ({ active: id, visited: previous.visited.includes(id) ? previous.visited : [...previous.visited, id] }))
          window.history.replaceState(window.history.state, '', `#${id}`)
          root.current?.scrollIntoView({ block: 'start' })
        }} className="min-h-11 w-full border border-white/20 bg-bg-primary px-3 text-base font-semibold text-white focus:border-brand">
          {sections.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}
        </select>
      </div>
      {children}
    </div>
  </EditorialWorkspaceContext.Provider>
}
