import type { ReactNode } from 'react'
import StaffCopilotQaCard from '@/components/StaffCopilotQaCard'

export default function BetaQaLayout({ children }: { children: ReactNode }) {
  return <>{children}<StaffCopilotQaCard /></>
}
