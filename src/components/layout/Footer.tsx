import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-bg-secondary/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-bold text-brand mb-4">BVS Radio</h3>
            <p className="text-sm text-text-secondary">
              Zimbabwe's premier online radio station. Discover African music, upload your tracks, and connect with artists.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3">Platform</h4>
            <div className="flex flex-col gap-2">
              <Link href="/catalogue" className="text-sm text-text-secondary hover:text-brand transition-colors">Catalogue</Link>
              <Link href="/upload" className="text-sm text-text-secondary hover:text-brand transition-colors">Upload Music</Link>
              <Link href="/radio" className="text-sm text-text-secondary hover:text-brand transition-colors">Live Radio</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3">Company</h4>
            <div className="flex flex-col gap-2">
              <Link href="/about" className="text-sm text-text-secondary hover:text-brand transition-colors">About</Link>
              <Link href="/contact" className="text-sm text-text-secondary hover:text-brand transition-colors">Contact</Link>
              <Link href="/shop" className="text-sm text-text-secondary hover:text-brand transition-colors">Shop</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3">Follow Us</h4>
            <div className="flex flex-col gap-2">
              <a href="https://instagram.com/bvsradio" target="_blank" rel="noopener noreferrer" className="text-sm text-text-secondary hover:text-brand transition-colors">Instagram</a>
              <a href="https://twitter.com/bvsradio" target="_blank" rel="noopener noreferrer" className="text-sm text-text-secondary hover:text-brand transition-colors">Twitter / X</a>
              <a href="https://facebook.com/bvsradio" target="_blank" rel="noopener noreferrer" className="text-sm text-text-secondary hover:text-brand transition-colors">Facebook</a>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-white/10 text-center text-xs text-text-secondary">
          &copy; {new Date().getFullYear()} BVS Radio. All rights reserved.
        </div>
      </div>
    </footer>
  )
}