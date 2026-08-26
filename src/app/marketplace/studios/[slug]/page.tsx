"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import StudioDiscoveryMap from "@/components/StudioDiscoveryMap";
import { marketplaceStorefronts, type MarketplaceStorefront } from "@/lib/marketplace-storefronts";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { studioPriceLabel, type StudioDiscoveryProfile } from "@/lib/studio-marketplace";

type MarketplacePayload = { profiles?: Parameters<typeof marketplaceStorefronts>[0]; listings?: Parameters<typeof marketplaceStorefronts>[1] };
type Review = { id: string; rating: number; soundQuality?: number | null; communication?: number | null; valueRating?: number | null; comment?: string | null; createdAt: string; reviewerLabel: string };
type ReviewPayload = { reviews?: Review[]; eligibleBookings?: Array<{ id: string; serviceTitle: string; endedAt: string }> };

function Stars({ value }: { value: number }) {
  return <span aria-label={`${value} out of 5 stars`} className="tracking-[.08em] text-brand">{"★★★★★".slice(0, Math.round(value))}<span className="text-white/15">{"★★★★★".slice(Math.round(value))}</span></span>;
}

export default function StudioDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params.slug || "");
  const [marketplace, setMarketplace] = useState<MarketplacePayload>({});
  const [studios, setStudios] = useState<StudioDiscoveryProfile[]>([]);
  const [reviews, setReviews] = useState<ReviewPayload>({});
  const [token, setToken] = useState("");
  const [reviewForm, setReviewForm] = useState({ bookingId: "", rating: 5, soundQuality: 5, communication: 5, valueRating: 5, comment: "" });
  const [reviewMessage, setReviewMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeImage, setActiveImage] = useState("");

  const loadReviews = async (accessToken = "") => {
    const response = await fetch(`/api/marketplace/studios/reviews?provider=${encodeURIComponent(slug)}`, {
      cache: "no-store",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (response.ok) setReviews(await response.json());
  };

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/marketplace", { cache: "no-store", signal: controller.signal }).then((r) => r.ok ? r.json() : {}),
      fetch("/api/marketplace/studios", { cache: "no-store", signal: controller.signal }).then((r) => r.ok ? r.json() : { studios: [] }),
    ]).then(([market, studioData]) => {
      setMarketplace(market);
      setStudios(studioData.studios || []);
      setLoaded(true);
    }).catch(() => setLoaded(true));
    void loadReviews();
    if (isSupabaseConfigured()) {
      void createClient().auth.getSession().then(({ data }) => {
        const accessToken = data.session?.access_token || "";
        setToken(accessToken);
        if (accessToken) void loadReviews(accessToken);
      });
    }
    return () => controller.abort();
  }, [slug]);

  const storefronts = useMemo(() => marketplaceStorefronts(marketplace.profiles || [], marketplace.listings || []), [marketplace]);
  const provider = storefronts.find((item) => item.slug === slug) || null;
  const studio = studios.find((item) => item.providerKey === slug) || null;
  const bookable = provider?.services.filter((service) => service.bookingMode === "calendar") || [];
  const otherServices = provider?.services.filter((service) => service.bookingMode !== "calendar") || [];

  useEffect(() => {
    const first = reviews.eligibleBookings?.[0];
    if (first && !reviewForm.bookingId) setReviewForm((current) => ({ ...current, bookingId: first.id }));
  }, [reviews.eligibleBookings, reviewForm.bookingId]);

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!token || !reviewForm.bookingId) return;
    setBusy(true);
    setReviewMessage("");
    try {
      const response = await fetch("/api/marketplace/studios/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(reviewForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not publish review.");
      setReviewMessage("Your verified studio review is live.");
      setReviewForm((current) => ({ ...current, comment: "" }));
      await loadReviews(token);
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Could not publish review.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <main className="mx-auto max-w-7xl px-6 py-12"><div className="h-96 animate-pulse rounded-[2rem] bg-white/[.04]" /></main>;
  if (!provider || !studio) {
    return <main className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-4xl font-semibold">Studio not found</h1><p className="mt-3 text-text-secondary">This studio may not be published for location discovery yet.</p><Link href="/marketplace/studios" className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 font-semibold text-black">Browse BVS Studios</Link></main>;
  }

  const gallery = [...new Set([...studio.gallery, provider.heroImage].filter((value): value is string => Boolean(value)))];
  const hero = activeImage || gallery[0];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <Link href={`/marketplace/studios?city=${encodeURIComponent(studio.city)}`} className="text-sm text-brand hover:underline">← Studios in {studio.city}</Link>

      <section className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025]">
        <div className="relative min-h-[360px] sm:min-h-[460px]">
          {hero ? <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/5" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-brand">
              <span>BVS Studio</span>{studio.verified ? <span>· Verified</span> : null}
            </div>
            <h1 className="mt-2 text-balance text-4xl font-semibold text-white sm:text-6xl">{studio.displayName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/75">
              <span>{studio.locationLabel}</span>
              {studio.rating ? <span className="font-semibold text-white">★ {studio.rating.toFixed(1)} · {studio.reviewCount} verified {studio.reviewCount === 1 ? "review" : "reviews"}</span> : <span>New on BVS · no verified reviews yet</span>}
              <span className="font-semibold text-brand">{studioPriceLabel(studio.hourlyFromUsd)}</span>
            </div>
          </div>
        </div>
      </section>

      {gallery.length > 1 ? <section className="mt-4 flex gap-3 overflow-x-auto pb-2" aria-label="Studio photos">{gallery.map((image, index) => <button key={image} type="button" onClick={() => setActiveImage(image)} className={`relative h-24 w-36 shrink-0 overflow-hidden rounded-2xl border transition ${hero === image ? "border-brand" : "border-white/10 hover:border-white/30"}`}><img src={image} alt={`${studio.displayName} photo ${index + 1}`} className="h-full w-full object-cover" /></button>)}</section> : null}

      <div className="mt-9 grid gap-9 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-10">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">The studio</p>
            <h2 className="mt-2 text-3xl font-semibold">Made for BVS creators who want to get the session booked, not chase DMs.</h2>
            <p className="mt-4 max-w-3xl leading-relaxed text-text-secondary">{provider.bio || provider.headline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[...studio.roomTypes, ...studio.amenities, ...provider.specialties].slice(0, 12).map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/[.025] px-3 py-2 text-xs text-text-secondary">{item.replaceAll("_", " ")}</span>)}
            </div>
          </section>

          <section id="packages">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Sessions &amp; packages</p>
            <h2 className="mt-2 text-3xl font-semibold">Choose what you need</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {bookable.map((service) => (
                <article key={service.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-brand">{service.category}</p><h3 className="mt-2 text-xl font-semibold">{service.title}</h3></div><strong className="text-brand">{service.priceLabel || `$${service.priceUsd.toFixed(2)}`}</strong></div>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{service.description}</p>
                  {service.packages?.length ? <div className="mt-4 space-y-2">{service.packages.map((pkg, index) => <div key={`${pkg.name}-${index}`} className="rounded-xl border border-white/10 p-3"><div className="flex justify-between gap-3 text-sm"><div><strong>{pkg.name}</strong>{pkg.description ? <p className="mt-1 text-xs text-text-secondary">{pkg.description}</p> : null}</div><span className="shrink-0 text-brand">${pkg.priceUsd.toFixed(2)}</span></div><Link href={`/marketplace/${provider.slug}/book?service=${encodeURIComponent(service.id)}&package=${index}`} className="mt-3 inline-flex rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black">Choose {pkg.name}</Link></div>)}</div> : <Link href={`/marketplace/${provider.slug}/book?service=${encodeURIComponent(service.id)}`} className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">See availability &amp; book</Link>}
                </article>
              ))}
            </div>
            {otherServices.length ? <div className="mt-5 rounded-2xl border border-white/10 p-5"><p className="text-sm font-semibold">More from {provider.name}</p><div className="mt-3 flex flex-wrap gap-2">{otherServices.map((service) => <Link key={service.id} href={`/marketplace/${provider.slug}?service=${encodeURIComponent(service.id)}`} className="rounded-full border border-white/10 px-3 py-2 text-xs text-text-secondary hover:border-brand/40 hover:text-brand">{service.title} · {service.priceLabel || `$${service.priceUsd.toFixed(0)}`}</Link>)}</div></div> : null}
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Verified client ratings</p><h2 className="mt-2 text-3xl font-semibold">What previous BVS clients say</h2></div>{studio.rating ? <div className="text-right"><p className="text-3xl font-semibold">{studio.rating.toFixed(1)}</p><Stars value={studio.rating} /></div> : null}</div>
            {!reviews.reviews?.length ? <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-6 text-sm text-text-secondary">No verified client reviews yet. Ratings only unlock after a confirmed BVS booking has ended, so stars cannot be self-awarded.</div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{reviews.reviews.map((review) => <article key={review.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="flex items-center justify-between"><Stars value={review.rating} /><span className="text-xs text-text-secondary">{new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(review.createdAt))}</span></div>{review.comment ? <p className="mt-4 text-sm leading-relaxed text-text-secondary">“{review.comment}”</p> : null}<div className="mt-4 flex flex-wrap gap-2 text-[10px] text-text-secondary">{review.soundQuality ? <span className="rounded-full border border-white/10 px-2 py-1">Sound {review.soundQuality}/5</span> : null}{review.communication ? <span className="rounded-full border border-white/10 px-2 py-1">Communication {review.communication}/5</span> : null}{review.valueRating ? <span className="rounded-full border border-white/10 px-2 py-1">Value {review.valueRating}/5</span> : null}</div><p className="mt-4 text-xs font-semibold text-brand">{review.reviewerLabel}</p></article>)}</div>}

            {reviews.eligibleBookings?.length ? <form onSubmit={submitReview} className="mt-6 rounded-2xl border border-brand/25 bg-brand/[.035] p-5"><p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Rate a completed session</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={reviewForm.bookingId} onChange={(e) => setReviewForm({ ...reviewForm, bookingId: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{reviews.eligibleBookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.serviceTitle}</option>)}</select><select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} stars overall</option>)}</select><select value={reviewForm.soundQuality} onChange={(e) => setReviewForm({ ...reviewForm, soundQuality: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>Sound quality · {rating}/5</option>)}</select><select value={reviewForm.communication} onChange={(e) => setReviewForm({ ...reviewForm, communication: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>Communication · {rating}/5</option>)}</select><select value={reviewForm.valueRating} onChange={(e) => setReviewForm({ ...reviewForm, valueRating: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm sm:col-span-2">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>Value · {rating}/5</option>)}</select><textarea rows={3} value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm sm:col-span-2" placeholder="How was the studio session?" /></div><button disabled={busy} className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40">{busy ? "Publishing…" : "Publish verified review"}</button>{reviewMessage ? <p className="mt-3 text-xs text-text-secondary">{reviewMessage}</p> : null}</form> : null}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Book this studio</p><p className="mt-2 text-2xl font-semibold">{studioPriceLabel(studio.hourlyFromUsd)}</p><p className="mt-2 text-sm text-text-secondary">Packages, published time slots and booking requests stay inside BVS.</p>{bookable[0] ? <Link href={`/marketplace/${provider.slug}/book?service=${encodeURIComponent(bookable[0].id)}`} className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-brand px-5 font-semibold text-black">Check availability</Link> : <Link href={`/marketplace/${provider.slug}`} className="mt-5 flex min-h-12 items-center justify-center rounded-full border border-brand/40 px-5 font-semibold text-brand">View services</Link>}</div>
          <StudioDiscoveryMap studios={[studio]} selectedKey={studio.providerKey} onSelect={() => null} />
          <div className="rounded-2xl border border-white/10 p-4 text-xs text-text-secondary"><strong className="text-white">Location privacy:</strong> {studio.locationPrecision === "exact" ? "this provider chose to publish an exact pin." : "the public discovery pin is approximate. Exact arrival details can stay within the confirmed booking flow."}</div>
        </aside>
      </div>
    </main>
  );
}
