import type { Metadata } from 'next'
import StaffCopilotDesk from '@/components/StaffCopilotDesk'

export const metadata: Metadata = {
  title: 'BVS Ops Copilot',
  description: 'Staff-only beta operations copilot for controlled read tools.',
}

export default function StaffCopilotPage() {
  return <main className="pt-16"><StaffCopilotDesk /></main>
}
