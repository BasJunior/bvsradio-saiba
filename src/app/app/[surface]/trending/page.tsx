import { notFound } from 'next/navigation'
import TrendingBoard from '@/components/TrendingBoard'
export default async function AppTrendingPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params
  if (surface !== 'ios' && surface !== 'android') notFound()
  return <main className="mx-auto max-w-4xl px-4 pb-32 pt-6"><h1 className="text-3xl font-semibold">BVS Trending</h1><TrendingBoard surface={surface} /></main>
}
