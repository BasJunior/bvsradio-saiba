import fs from "node:fs";

function edit(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) {
    console.log(`${path}: already finalized or no change required.`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`${path}: finalized.`);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`${label} marker not found; refusing broad rewrite.`);
  return source.replace(from, to);
}

edit("package.json", (source) => replaceOnce(
  source,
  '    "test:staff-copilot": "node --experimental-strip-types scripts/staff-copilot-tests.mjs",\n',
  '    "test:staff-copilot": "node --experimental-strip-types scripts/staff-copilot-tests.mjs",\n    "test:studio-marketplace": "node --experimental-strip-types scripts/studio-marketplace-tests.mjs",\n',
  "package script",
));

edit("src/app/marketplace/page.tsx", (source) => replaceOnce(
  source,
  '        <div className="mt-7 flex flex-wrap gap-3">\n          <a href="#providers" className="rounded-full bg-brand px-5 py-2.5 font-semibold text-black">Studios &amp; engineers</a>',
  '        <div className="mt-7 flex flex-wrap gap-3">\n          <Link href="/marketplace/studios" className="rounded-full bg-brand px-5 py-2.5 font-semibold text-black">Book a studio session near you</Link>\n          <a href="#providers" className="rounded-full border border-white/20 px-5 py-2.5">Studios &amp; engineers</a>',
  "marketplace studio CTA",
));

edit("src/app/creator/marketplace/page.tsx", (source) => {
  let next = replaceOnce(
    source,
    'import MarketplaceAvailabilityDesk from "@/components/MarketplaceAvailabilityDesk";\n',
    'import MarketplaceAvailabilityDesk from "@/components/MarketplaceAvailabilityDesk";\nimport StudioMarketplaceProfileDesk from "@/components/StudioMarketplaceProfileDesk";\n',
    "creator studio discovery import",
  );
  next = replaceOnce(
    next,
    '      <CreatorMarketplaceDesk embedded />\n      <MarketplaceAvailabilityDesk />',
    '      <CreatorMarketplaceDesk embedded />\n      <StudioMarketplaceProfileDesk />\n      <MarketplaceAvailabilityDesk />',
    "creator studio discovery desk",
  );
  return next;
});

for (const path of ["src/app/api/marketplace/route.ts", "src/components/CreatorMarketplaceDesk.tsx"]) {
  edit(path, (source) => replaceOnce(
    source,
    '  "mixing",\n  "mastering",\n  "production",',
    '  "recording",\n  "studio_session",\n  "rehearsal",\n  "podcast_recording",\n  "mixing",\n  "mastering",\n  "production",',
    `${path} studio service categories`,
  ));
}

edit("src/app/api/marketplace/bookings/route.ts", (source) => {
  let next = replaceOnce(
    source,
    'async function authoritativeService(providerKey: string, serviceRef: string) {',
    'async function authoritativeService(providerKey: string, serviceRef: string, packageIndex?: number) {',
    "booking authoritative service signature",
  );
  next = replaceOnce(
    next,
    '  const seededService = seeded?.services.find((service) => service.id === serviceRef);\n  if (seededService) return { service: seededService, listingId: null as string | null };',
    '  const seededService = seeded?.services.find((service) => service.id === serviceRef);\n  if (seededService) {\n    if (packageIndex !== undefined) {\n      const selectedPackage = seededService.packages?.[packageIndex];\n      if (!selectedPackage) return null;\n      return { service: { ...seededService, title: `${seededService.title} — ${selectedPackage.name}`, priceUsd: selectedPackage.priceUsd, packages: [] }, listingId: null as string | null };\n    }\n    return { service: seededService, listingId: null as string | null };\n  }',
    "seeded package authority",
  );
  next = replaceOnce(
    next,
    '  const service: StorefrontService = {',
    '  let service: StorefrontService = {',
    "creator service mutability",
  );
  next = replaceOnce(
    next,
    '  };\n  return { service, listingId: String(row.id) };\n}',
    '  };\n  if (packageIndex !== undefined) {\n    const selectedPackage = service.packages?.[packageIndex];\n    if (!selectedPackage) return null;\n    service = { ...service, title: `${service.title} — ${selectedPackage.name}`, priceUsd: selectedPackage.priceUsd, packages: [] };\n  }\n  return { service, listingId: String(row.id) };\n}',
    "creator package authority",
  );
  next = replaceOnce(
    next,
    '  const serviceRef = clean(body.serviceRef, 160);\n  const slotId = clean(body.slotId, 80);',
    '  const serviceRef = clean(body.serviceRef, 160);\n  const packageIndex = body.packageIndex === undefined || body.packageIndex === null || body.packageIndex === "" ? undefined : Number(body.packageIndex);\n  const slotId = clean(body.slotId, 80);',
    "package input parse",
  );
  next = replaceOnce(
    next,
    '  if (!providerKey || !serviceRef || !slotId || !customerName || !customerEmail) {',
    '  if (!providerKey || !serviceRef || !slotId || !customerName || !customerEmail || (packageIndex !== undefined && (!Number.isInteger(packageIndex) || packageIndex < 0 || packageIndex > 20))) {',
    "package input validation",
  );
  next = replaceOnce(
    next,
    '  const authoritative = await authoritativeService(providerKey, serviceRef);',
    '  const authoritative = await authoritativeService(providerKey, serviceRef, packageIndex);',
    "package authoritative resolve",
  );
  return next;
});

edit("src/app/marketplace/[slug]/book/page.tsx", (source) => {
  let next = replaceOnce(
    source,
    '  const serviceRef = search.get("service") || "";\n',
    '  const serviceRef = search.get("service") || "";\n  const packageRaw = search.get("package");\n  const packageIndex = packageRaw == null ? undefined : Number(packageRaw);\n',
    "booking package query",
  );
  next = replaceOnce(
    next,
    '  const service = provider?.services.find((item) => item.id === serviceRef) || null;\n',
    '  const service = provider?.services.find((item) => item.id === serviceRef) || null;\n  const selectedPackage = service && packageIndex !== undefined && Number.isInteger(packageIndex) && packageIndex >= 0 ? service.packages?.[packageIndex] : undefined;\n',
    "booking selected package",
  );
  next = replaceOnce(
    next,
    '          serviceRef: service.id,\n          slotId: selectedSlot,',
    '          serviceRef: service.id,\n          packageIndex: selectedPackage ? packageIndex : undefined,\n          slotId: selectedSlot,',
    "booking package post",
  );
  next = replaceOnce(
    next,
    '          <h1 className="mt-2 text-balance text-4xl font-semibold sm:text-5xl">{service.title}</h1>',
    '          <h1 className="mt-2 text-balance text-4xl font-semibold sm:text-5xl">{selectedPackage ? `${service.title} — ${selectedPackage.name}` : service.title}</h1>',
    "booking package title",
  );
  next = replaceOnce(
    next,
    '          <p className="mt-4 text-2xl font-semibold text-brand">{service.priceLabel || `$${service.priceUsd.toFixed(2)}`}</p>',
    '          <p className="mt-4 text-2xl font-semibold text-brand">{selectedPackage ? `$${selectedPackage.priceUsd.toFixed(2)}` : service.priceLabel || `$${service.priceUsd.toFixed(2)}`}</p>',
    "booking package price",
  );
  return next;
});

console.log("BVS Studios beta finalization complete.");
