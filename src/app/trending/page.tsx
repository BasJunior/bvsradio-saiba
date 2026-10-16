import TrendingBoard from '@/components/TrendingBoard'
export const metadata = { title: 'BVS Trending · Songs gaining momentum', description: 'Discover the songs BVS listeners are moving right now.' }
export default function TrendingPage() { return <main className="mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-6"><h1 className="text-4xl font-semibold">BVS Trending</h1><TrendingBoard /></main> }
