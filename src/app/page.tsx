export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/10 via-transparent to-bg-primary" />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-brand via-brand-light to-brand bg-clip-text text-transparent">
            Zimbabwe's Sound
          </h1>
          <p className="text-lg md:text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
            Upload your music, build your catalogue, and get discovered.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/auth/signup"
              className="px-8 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark transition-all text-lg"
            >
              Join as an Artist
            </a>
            <a
              href="/catalogue"
              className="px-8 py-3 border border-white/20 text-text-primary font-semibold rounded-full hover:bg-white/5 transition-all text-lg"
            >
              Browse Catalogue
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Built for <span className="text-brand">African Artists</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-bg-card/50 backdrop-blur rounded-2xl p-8 border border-white/10 hover:border-brand/30 transition-all">
              <div className="w-12 h-12 bg-brand/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Upload & Share</h3>
              <p className="text-text-secondary">Upload your tracks with artwork and metadata. Share with the world instantly.</p>
            </div>
            <div className="bg-bg-card/50 backdrop-blur rounded-2xl p-8 border border-white/10 hover:border-brand/30 transition-all">
              <div className="w-12 h-12 bg-brand/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Artist Profiles</h3>
              <p className="text-text-secondary">Build your artist brand with a custom profile, bio, and full music catalogue.</p>
            </div>
            <div className="bg-bg-card/50 backdrop-blur rounded-2xl p-8 border border-white/10 hover:border-brand/30 transition-all">
              <div className="w-12 h-12 bg-brand/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Get Discovered</h3>
              <p className="text-text-secondary">Featured tracks, weekly charts, and a growing community of music lovers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to share your music?
          </h2>
          <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
            Join Zimbabwe's fastest-growing music platform. Free to join.
          </p>
          <a
            href="/auth/signup"
            className="px-10 py-4 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark transition-all text-lg inline-block"
          >
            Create Your Account
          </a>
        </div>
      </section>
    </>
  )
}