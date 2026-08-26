import fs from "node:fs";

const path = "src/app/marketplace/studios/page.tsx";
let source = fs.readFileSync(path, "utf8");
const before = `  const cards = useMemo<StudioCard[]>(() => {\n    return (studioPayload.studios || [])\n      .map((studio) => {\n        const provider = storefronts.find((item) => item.slug === studio.providerKey);\n        if (!provider) return null;\n        const servicePrices = provider.services.filter((service) => service.bookingMode === \"calendar\" && service.priceUsd > 0).map((service) => service.priceUsd);\n        const lowest = servicePrices.length ? Math.min(...servicePrices) : null;\n        const enrichedStudio = { ...studio, hourlyFromUsd: lowest ?? studio.hourlyFromUsd };\n        const distanceKm = geo && Number.isFinite(enrichedStudio.latitude) && Number.isFinite(enrichedStudio.longitude)\n          ? haversineKm(geo.lat, geo.lng, Number(enrichedStudio.latitude), Number(enrichedStudio.longitude))\n          : null;\n        return { studio: enrichedStudio, provider, distanceKm };\n      })\n      .filter((item): item is StudioCard => Boolean(item));\n  }, [studioPayload.studios, storefronts, geo]);`;
const after = `  const cards = useMemo<StudioCard[]>(() => {\n    const result: StudioCard[] = [];\n    for (const studio of studioPayload.studios || []) {\n      const provider = storefronts.find((item) => item.slug === studio.providerKey);\n      if (!provider) continue;\n      const servicePrices = provider.services\n        .filter((service) => service.bookingMode === \"calendar\" && service.priceUsd > 0)\n        .map((service) => service.priceUsd);\n      const lowest = servicePrices.length ? Math.min(...servicePrices) : null;\n      const enrichedStudio: StudioDiscoveryProfile = {\n        ...studio,\n        hourlyFromUsd: lowest ?? studio.hourlyFromUsd ?? null,\n      };\n      const distanceKm = geo && Number.isFinite(enrichedStudio.latitude) && Number.isFinite(enrichedStudio.longitude)\n        ? haversineKm(geo.lat, geo.lng, Number(enrichedStudio.latitude), Number(enrichedStudio.longitude))\n        : null;\n      result.push({ studio: enrichedStudio, provider, distanceKm });\n    }\n    return result;\n  }, [studioPayload.studios, storefronts, geo]);`;

if (source.includes(after)) {
  console.log("Studio discovery card typing already fixed.");
  process.exit(0);
}
if (!source.includes(before)) throw new Error("Studio discovery type-fix marker not found; refusing broad rewrite.");
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log("Studio discovery card typing fixed.");
