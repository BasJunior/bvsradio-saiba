import type { ReactNode } from 'react'
import CheckoutFunnelAnalytics from '@/components/CheckoutFunnelAnalytics'

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CheckoutFunnelAnalytics />
      {children}
    </>
  )
}
