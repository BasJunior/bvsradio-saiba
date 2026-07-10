import Link from 'next/link'
import Image from 'next/image'
import { featuredPosts } from '@/lib/blog'

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-primary/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/assets/images/Bvsradio_logo.png" alt="BVS Radio" width={32} height={32} className="rounded" />
          <span className="text-xl font-bold text-brand">BVS Radio</span>
        </Link>

        <div className="hidden md:flex items-center gap-5">
          <Link href="/radio" className="text-sm text-text-secondary hover:text-brand transition-colors">Radio</Link>
          <Link href="/catalogue" className="text-sm text-text-secondary hover:text-brand transition-colors">Catalogue</Link>
          <Link href="/upload" className="text-sm text-text-secondary hover:text-brand transition-colors">Upload</Link>
          <Link href="/blog" className="text-sm text-text-secondary hover:text-brand transition-colors">Blog</Link>
          <Link href="/shop" className="text-sm text-text-secondary hover:text-brand transition-colors">Shop</Link>
          <Link href="/about" className="text-sm text-text-secondary hover:text-brand transition-colors">About</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-2 text-sm text-text-primary hover:text-brand transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-2 text-sm font-medium bg-brand text-black rounded-full hover:bg-brand-dark transition-colors"
          >
            Join Free
          </Link>
        </div>
      </div>
    </nav>
  )
}