import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Shop",
  description: "BVS Radio Shop — exclusive merchandise, music gear, and deals",
};

const products = [
  { name: "BVS Radio Logo T-Shirt", price: "$24.99", desc: "Premium cotton tee with embroidered BVS logo" },
  { name: "BVS Radio Ceramic Mug", price: "$14.99", desc: "12oz ceramic mug with gold foil logo" },
  { name: "BVS Radio Pullover Hoodie", price: "$39.99", desc: "Heavyweight fleece hoodie with front pocket" },
  { name: "BVS Radio Cap", price: "$19.99", desc: "Dad hat style with embroidered front logo" },
  { name: "BVS Radio Sticker Pack", price: "$5.99", desc: "5 vinyl stickers featuring BVS designs" },
  { name: "BVS Radio Phone Case", price: "$15.99", desc: "Impact-resistant case with printed artwork" },
];

export default function ShopPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <section className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">BVS Radio Shop</h1>
        <p className="text-text-secondary text-lg">
          Exclusive merchandise, music gear, and special deals for BVS Radio fans and supporters.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Featured Items</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.name}
              className="bg-bg-card/50 backdrop-blur rounded-xl border border-white/10 overflow-hidden hover:border-brand/30 transition-all group"
            >
              <div className="aspect-square bg-gradient-to-br from-brand/10 to-accent/10 flex items-center justify-center">
                <Image
                  src="/assets/images/Bvsradio_logo.png"
                  alt={product.name}
                  width={120}
                  height={120}
                  className="opacity-60 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-sm text-text-secondary mb-2">{product.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-brand">{product.price}</span>
                  <button className="px-4 py-2 bg-brand text-black text-sm font-semibold rounded-full hover:bg-brand-dark transition-all">
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8">
          <h2 className="text-2xl font-semibold mb-4">Exclusive Deals</h2>
          <p className="text-text-secondary mb-4">Limited-time offers on:</p>
          <ul className="space-y-3 text-text-secondary">
            {[
              "Music production equipment",
              "Headphones and audio gear",
              "Concert tickets and festival passes",
              "Vinyl records and music memorabilia",
              "Streaming service subscriptions",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-brand mt-1">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8">
          <h2 className="text-2xl font-semibold mb-4">How to Order</h2>
          <ol className="space-y-3 text-text-secondary">
            {[
              "Browse our featured products above",
              'Click "Add to Cart" on items you want',
              "Review your cart and proceed to checkout",
              "Enter shipping and payment information",
              "Confirm your order and await confirmation email",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-brand/20 text-brand rounded-full flex items-center justify-center text-sm font-semibold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}