import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <Image
          src="/assets/images/Bvsradio_logo.png"
          alt="BVS Radio"
          width={120}
          height={120}
          className="mx-auto mb-8 rounded-2xl"
          priority
        />
        
        <h1 className="text-6xl font-bold mb-6 tracking-tight">
          BVS Radio
        </h1>
        
        <p className="text-2xl text-zinc-400 mb-12">
          Zimbabwe's Sound • Live • Culture • Community
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/radio"
            className="px-10 py-4 bg-yellow-400 hover:bg-yellow-300 transition-colors text-black font-semibold rounded-full text-lg inline-flex items-center justify-center gap-3"
          >
            ▶️ Listen Live Now
          </Link>
          
          <Link
            href="/shop"
            className="px-10 py-4 border border-white/30 hover:bg-white/10 transition-colors font-medium rounded-full text-lg"
          >
            Shop Deals
          </Link>
        </div>

        <p className="mt-16 text-sm text-zinc-500">
          Deployment fixed • RadioPlayer component temporarily disabled to resolve blank page
        </p>
      </div>
    </div>
  );
}
