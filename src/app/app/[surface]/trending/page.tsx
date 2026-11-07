import { notFound } from 'next/navigation'
import TrendingBoard from '@/components/TrendingBoard'
export default async function AppTrendingPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params
  if (surface !== 'ios' && surface !== 'android') notFound()
  return <main className="bvs-app-page mx-auto max-w-4xl px-4 pb-32 pt-5 sm:px-6" data-app-accent="lime">
    <header>
      <p className="bvs-app-eyebrow">What listeners are playing</p>
      <h1 className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">Trending</h1>
    </header>
    <div className="bvs-app-trending"><TrendingBoard surface={surface} /></div>
  </main>
}
