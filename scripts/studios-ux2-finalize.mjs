import fs from "node:fs";

function edit(path, transform) {
  const source = fs.readFileSync(path, "utf8");
  const next = transform(source);
  if (next === source) console.log(`${path}: already finalized or no change required.`);
  else {
    fs.writeFileSync(path, next);
    console.log(`${path}: finalized.`);
  }
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`${label} marker not found; refusing broad rewrite.`);
  return source.replace(from, to);
}

edit("src/components/layout/Navbar.tsx", (source) => {
  source = source.replace('              {showEditorial && <Link href="/admin/copilot" className="px-2.5 py-2 text-sm text-text-secondary hover:text-brand transition-colors">Ops Copilot</Link>}\n', "");
  source = source.replace('                  {showEditorial && <Link href="/admin/copilot" className="py-2 text-text-primary hover:text-brand" onClick={() => setIsMenuOpen(false)}>Ops Copilot</Link>}\n', "");
  if (source.includes('href="/admin/copilot"')) throw new Error("Ops Copilot still appears in global Navbar; refusing to finalize.");
  return source;
});

edit("src/components/MarketplaceAvailabilityDesk.tsx", (source) => {
  source = replaceOnce(
    source,
    '  const available = useMemo(() => slots.filter((slot) => slot.status === "available"), [slots]);\n  const pendingBookings = useMemo(() => bookings.filter((booking) => booking.status === "requested"), [bookings]);\n  const confirmedBookings = useMemo(() => bookings.filter((booking) => booking.status === "confirmed"), [bookings]);\n  const slotById = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);',
    '  const available = useMemo(() => slots.filter((slot) => slot.status === "available"), [slots]);\n  const pendingBookings = useMemo(() => bookings.filter((booking) => booking.status === "requested"), [bookings]);\n  const confirmedBookings = useMemo(() => bookings.filter((booking) => booking.status === "confirmed"), [bookings]);\n  const slotById = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);\n  const upcomingConfirmedBookings = useMemo(() => confirmedBookings.filter((booking) => {\n    const slot = slotById.get(booking.slot_id);\n    return !slot || Date.parse(slot.ends_at) >= Date.now();\n  }), [confirmedBookings, slotById]);\n  const completedBookings = useMemo(() => confirmedBookings.filter((booking) => {\n    const slot = slotById.get(booking.slot_id);\n    return Boolean(slot && Date.parse(slot.ends_at) < Date.now());\n  }), [confirmedBookings, slotById]);',
    "booking lifecycle derivation",
  );

  const oldConfirmed = `          {confirmedBookings.length ? (\n            <div className="mt-8 border-t border-white/10 pt-7">\n              <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Confirmed sessions</p>\n              <div className="mt-3 space-y-2">\n                {confirmedBookings.map((booking) => {\n                  const slot = slotById.get(booking.slot_id);\n                  return (\n                    <div key={booking.id} className="rounded-xl border border-white/10 p-4">\n                      <div className="flex flex-wrap justify-between gap-3">\n                        <div><p className="font-medium">{booking.service_title} · {booking.customer_name}</p>{slot ? <p className="mt-1 text-xs text-text-secondary">{label(slot)}</p> : null}</div>\n                        <span className="text-xs font-semibold text-brand">Confirmed</span>\n                      </div>\n                    </div>\n                  );\n                })}\n              </div>\n            </div>\n          ) : null}`;
  const newConfirmed = `          {upcomingConfirmedBookings.length ? (\n            <div className="mt-8 border-t border-white/10 pt-7">\n              <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Upcoming confirmed sessions</p>\n              <div className="mt-3 space-y-2">\n                {upcomingConfirmedBookings.map((booking) => {\n                  const slot = slotById.get(booking.slot_id);\n                  return (\n                    <div key={booking.id} className="rounded-xl border border-white/10 p-4">\n                      <div className="flex flex-wrap justify-between gap-3">\n                        <div><p className="font-medium">{booking.service_title} · {booking.customer_name}</p>{slot ? <p className="mt-1 text-xs text-text-secondary">{label(slot)}</p> : null}</div>\n                        <span className="text-xs font-semibold text-brand">Confirmed · upcoming</span>\n                      </div>\n                    </div>\n                  );\n                })}\n              </div>\n            </div>\n          ) : null}\n\n          {completedBookings.length ? (\n            <div className="mt-8 border-t border-white/10 pt-7">\n              <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Completed sessions</p>\n              <p className="mt-1 text-xs text-text-secondary">Completed is derived from a confirmed booking whose published slot has ended. The client can now leave one verified BVS studio review.</p>\n              <div className="mt-3 space-y-2">\n                {completedBookings.map((booking) => {\n                  const slot = slotById.get(booking.slot_id);\n                  return (\n                    <div key={booking.id} className="rounded-xl border border-white/10 bg-white/[.02] p-4">\n                      <div className="flex flex-wrap justify-between gap-3">\n                        <div><p className="font-medium">{booking.service_title} · {booking.customer_name}</p>{slot ? <p className="mt-1 text-xs text-text-secondary">{label(slot)}</p> : null}</div>\n                        <span className="text-xs font-semibold text-text-secondary">Completed · review eligible</span>\n                      </div>\n                    </div>\n                  );\n                })}\n              </div>\n            </div>\n          ) : null}`;
  source = replaceOnce(source, oldConfirmed, newConfirmed, "confirmed session lifecycle UI");
  return source;
});

edit("src/app/marketplace/studios/[slug]/page.tsx", (source) => {
  source = replaceOnce(
    source,
    '  const [busy, setBusy] = useState(false);\n  const [loaded, setLoaded] = useState(false);',
    '  const [busy, setBusy] = useState(false);\n  const [loaded, setLoaded] = useState(false);\n  const [activeImage, setActiveImage] = useState("");',
    "studio gallery active image state",
  );

  source = replaceOnce(
    source,
    '  const hero = studio.gallery[0] || provider.heroImage;',
    '  const gallery = [...new Set([...studio.gallery, provider.heroImage].filter((value): value is string => Boolean(value)))];\n  const hero = activeImage || gallery[0];',
    "studio gallery derivation",
  );

  source = replaceOnce(
    source,
    '      </section>\n\n      <div className="mt-9 grid gap-9 lg:grid-cols-[minmax(0,1fr)_360px]">',
    '      </section>\n\n      {gallery.length > 1 ? <section className="mt-4 flex gap-3 overflow-x-auto pb-2" aria-label="Studio photos">{gallery.map((image, index) => <button key={image} type="button" onClick={() => setActiveImage(image)} className={`relative h-24 w-36 shrink-0 overflow-hidden rounded-2xl border transition ${hero === image ? "border-brand" : "border-white/10 hover:border-white/30"}`}><img src={image} alt={`${studio.displayName} photo ${index + 1}`} className="h-full w-full object-cover" /></button>)}</section> : null}\n\n      <div className="mt-9 grid gap-9 lg:grid-cols-[minmax(0,1fr)_360px]">',
    "studio gallery thumbnails",
  );

  const oldReviewGrid = '<div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={reviewForm.bookingId} onChange={(e) => setReviewForm({ ...reviewForm, bookingId: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{reviews.eligibleBookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.serviceTitle}</option>)}</select><select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} stars overall</option>)}</select><textarea rows={3} value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm sm:col-span-2" placeholder="How was the studio session?" /></div>';
  const newReviewGrid = '<div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={reviewForm.bookingId} onChange={(e) => setReviewForm({ ...reviewForm, bookingId: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{reviews.eligibleBookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.serviceTitle}</option>)}</select><select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} stars overall</option>)}</select><select value={reviewForm.soundQuality} onChange={(e) => setReviewForm({ ...reviewForm, soundQuality: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>Sound quality · {rating}/5</option>)}</select><select value={reviewForm.communication} onChange={(e) => setReviewForm({ ...reviewForm, communication: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>Communication · {rating}/5</option>)}</select><select value={reviewForm.valueRating} onChange={(e) => setReviewForm({ ...reviewForm, valueRating: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm sm:col-span-2">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>Value · {rating}/5</option>)}</select><textarea rows={3} value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm sm:col-span-2" placeholder="How was the studio session?" /></div>';
  source = replaceOnce(source, oldReviewGrid, newReviewGrid, "detailed verified review controls");

  source = replaceOnce(
    source,
    '{review.comment ? <p className="mt-4 text-sm leading-relaxed text-text-secondary">“{review.comment}”</p> : null}<p className="mt-4 text-xs font-semibold text-brand">{review.reviewerLabel}</p>',
    '{review.comment ? <p className="mt-4 text-sm leading-relaxed text-text-secondary">“{review.comment}”</p> : null}<div className="mt-4 flex flex-wrap gap-2 text-[10px] text-text-secondary">{review.soundQuality ? <span className="rounded-full border border-white/10 px-2 py-1">Sound {review.soundQuality}/5</span> : null}{review.communication ? <span className="rounded-full border border-white/10 px-2 py-1">Communication {review.communication}/5</span> : null}{review.valueRating ? <span className="rounded-full border border-white/10 px-2 py-1">Value {review.valueRating}/5</span> : null}</div><p className="mt-4 text-xs font-semibold text-brand">{review.reviewerLabel}</p>',
    "review subratings display",
  );

  return source;
});

console.log("BVS Studios UX2 narrow finalization complete.");
