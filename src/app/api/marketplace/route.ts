import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";
import { r2ObjectExists } from "@/lib/r2-storage";
import { creatorMarketplaceEntitlements } from "@/lib/creator-marketplace-entitlements";

export const runtime = "nodejs";

const roles = new Set([
  "artist",
  "producer",
  "engineer",
  "studio",
  "songwriter",
  "vocalist",
  "designer",
  "label_team",
]);
const productCategories = new Set([
  "drum_kit",
  "sample_pack",
  "preset",
  "loop_pack",
  "midi_pack",
  "stems",
  "template",
  "other",
]);
const serviceCategories = new Set([
  "mixing",
  "mastering",
  "production",
  "songwriting",
  "vocals",
  "vocal_tuning",
  "artwork",
  "podcast_editing",
  "other",
]);
const serviceSellerRoles = new Set([
  "producer",
  "engineer",
  "studio",
  "songwriter",
  "vocalist",
  "designer",
]);
const clean = (value: unknown, max: number) =>
  String(value || "")
    .trim()
    .slice(0, max);
const list = (value: unknown, allowed?: Set<string>) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .map((item) => clean(item, 60).toLowerCase().replaceAll(" ", "_"))
            .filter((item) => item && (!allowed || allowed.has(item))),
        ),
      ].slice(0, 12)
    : [];
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
const packageCode = (name: string, index: number) =>
  `${slugify(name) || "package"}-${index + 1}`;

async function rows(path: string) {
  const response = await fetch(creatorUrl(path), {
    headers: creatorHeaders,
    cache: "no-store",
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope") || "public";
  if (scope === "mine") {
    const identity = await creatorIdentity(request);
    if (!identity?.user?.id)
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const [profiles, listings, entitlements] = await Promise.all([
      rows(
        `creator_marketplace_profiles?user_id=eq.${identity.user.id}&select=*`,
      ),
      rows(
        `creator_marketplace_listings?seller_user_id=eq.${identity.user.id}&select=*&order=updated_at.desc`,
      ),
      creatorMarketplaceEntitlements(identity.user.id),
    ]);
    return NextResponse.json({
      profile: profiles[0] || null,
      listings,
      entitlements,
    });
  }

  const [profiles, listings] = await Promise.all([
    rows(
      "creator_marketplace_profiles?status=eq.approved&select=user_id,roles,headline,bio,experience,skills,genres,portfolio,accomplishments,credits,equipment,software,profiles!inner(username,display_name,creator_public_name,creator_name_status,avatar_url)&order=updated_at.desc&limit=200",
    ),
    rows(
      "creator_marketplace_listings?status=eq.published&select=id,seller_user_id,listing_type,category,title,slug,description,price_usd,artwork_path,preview_path,compatibility,licence_summary,packages,addons,turnaround_days,revisions_included,published_at,profiles!inner(username,display_name,creator_public_name,creator_name_status)&order=published_at.desc&limit=300",
    ),
  ]);
  return NextResponse.json({ profiles, listings });
}

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const action = clean(body.action, 30);

  if (action === "save_profile") {
    const selectedRoles = list(body.roles, roles);
    if (!selectedRoles.length)
      return NextResponse.json(
        { error: "Choose at least one creator role." },
        { status: 400 },
      );
    const accomplishments = Array.isArray(body.accomplishments)
      ? body.accomplishments
          .slice(0, 12)
          .map((item) => ({
            title: clean((item as Record<string, unknown>)?.title, 140),
            detail: clean((item as Record<string, unknown>)?.detail, 500),
            evidenceUrl: clean(
              (item as Record<string, unknown>)?.evidenceUrl,
              500,
            ),
            verification: "self_declared",
          }))
          .filter((item) => item.title)
      : [];
    const payload = {
      user_id: identity.user.id,
      roles: selectedRoles,
      headline: clean(body.headline, 180),
      bio: clean(body.bio, 3000),
      experience: clean(body.experience, 3000),
      skills: list(body.skills),
      genres: list(body.genres),
      equipment: list(body.equipment),
      software: list(body.software),
      portfolio: Array.isArray(body.portfolio)
        ? body.portfolio.slice(0, 24)
        : [],
      credits: Array.isArray(body.credits) ? body.credits.slice(0, 24) : [],
      accomplishments,
      status: body.submit === true ? "submitted" : "draft",
      review_notes: null,
      updated_at: new Date().toISOString(),
    };
    const response = await fetch(
      creatorUrl("creator_marketplace_profiles?on_conflict=user_id"),
      {
        method: "POST",
        headers: {
          ...creatorHeaders,
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok)
      return NextResponse.json(
        { error: "Could not save creator marketplace profile." },
        { status: 503 },
      );
    return NextResponse.json({ profile: (await response.json())[0] });
  }

  if (action === "save_listing") {
    const profile = (
      await rows(
        `creator_marketplace_profiles?user_id=eq.${identity.user.id}&status=eq.approved&select=user_id,roles&limit=1`,
      )
    )[0] as { user_id?: string; roles?: string[] } | undefined;
    if (!profile)
      return NextResponse.json(
        {
          error:
            "Editorial must approve your Creator Marketplace profile before listings can be submitted.",
        },
        { status: 403 },
      );
    const listingType = clean(body.listingType, 30);
    if (!["digital_product", "service"].includes(listingType))
      return NextResponse.json(
        { error: "Choose product or service." },
        { status: 400 },
      );
    if (
      listingType === "service" &&
      !(profile.roles || []).some((role) => serviceSellerRoles.has(role))
    )
      return NextResponse.json(
        {
          error:
            "Add an approved Producer, Engineer, Studio, Songwriter, Vocalist or Designer role before offering creator services.",
        },
        { status: 403 },
      );
    const category = clean(body.category, 40);
    const allowedCategories =
      listingType === "service" ? serviceCategories : productCategories;
    if (!allowedCategories.has(category))
      return NextResponse.json(
        { error: "Choose a valid category." },
        { status: 400 },
      );
    const title = clean(body.title, 160);
    const price = Number(body.priceUsd);
    if (!title || !Number.isFinite(price) || price < 1)
      return NextResponse.json(
        { error: "Title and a price of at least US$1 are required." },
        { status: 400 },
      );
    if (body.rightsConfirmed !== true)
      return NextResponse.json(
        {
          error:
            "Confirm that you control the rights and claims in this listing.",
        },
        { status: 400 },
      );
    const entitlements = await creatorMarketplaceEntitlements(identity.user.id);
    const existing = await rows(
      `creator_marketplace_listings?seller_user_id=eq.${identity.user.id}&listing_type=eq.${listingType}&status=not.in.(rejected,archived)&select=id`,
    );
    const limit =
      listingType === "service"
        ? entitlements.serviceListingLimit
        : entitlements.productListingLimit;
    if (limit != null && existing.length >= limit)
      return NextResponse.json(
        {
          error: `${entitlements.planId} allows ${limit} active ${listingType === "service" ? "service" : "product"} listing${limit === 1 ? "" : "s"}. Upgrade or archive an existing listing.`,
        },
        { status: 409 },
      );
    const assetPath = clean(body.assetPath, 500) || null;
    if (listingType === "digital_product" && body.submit === true && !assetPath)
      return NextResponse.json(
        { error: "Upload the private product file before submitting." },
        { status: 400 },
      );
    const paths = [
      assetPath,
      clean(body.artworkPath, 500),
      clean(body.previewPath, 500),
    ].filter((path): path is string => Boolean(path));
    if (
      paths.some((path) => !path.startsWith(`marketplace/${identity.user.id}/`))
    )
      return NextResponse.json(
        { error: "Invalid marketplace upload path." },
        { status: 400 },
      );
    if (
      paths.length &&
      (await Promise.all(paths.map((path) => r2ObjectExists(path)))).some(
        (exists) => !exists,
      )
    )
      return NextResponse.json(
        { error: "One or more files did not finish uploading." },
        { status: 400 },
      );
    const packages = Array.isArray(body.packages)
      ? body.packages
          .slice(0, entitlements.servicePackageLimit)
          .map((item, index) => {
            const name = clean((item as Record<string, unknown>)?.name, 100);
            return {
              code: packageCode(name, index),
              name,
              description: clean(
                (item as Record<string, unknown>)?.description,
                500,
              ),
              priceUsd: Math.round(
                Math.max(
                  1,
                  Number((item as Record<string, unknown>)?.priceUsd) || price,
                ) * 100,
              ) / 100,
            };
          })
          .filter((item) => item.name)
      : [];
    const addons =
      entitlements.addonsEnabled && Array.isArray(body.addons)
        ? body.addons.slice(0, 12).map((item) => ({
            name: clean((item as Record<string, unknown>)?.name, 100),
            description: clean(
              (item as Record<string, unknown>)?.description,
              500,
            ),
            priceUsd: Math.round(
              Math.max(0, Number((item as Record<string, unknown>)?.priceUsd) || 0) *
                100,
            ) / 100,
          })).filter((item) => item.name)
        : [];
    const payload = {
      seller_user_id: identity.user.id,
      listing_type: listingType,
      category,
      title,
      slug: `${slugify(title) || "listing"}-${crypto.randomUUID().slice(0, 6)}`,
      description: clean(body.description, 5000),
      price_usd: Math.round(price * 100) / 100,
      artwork_path: clean(body.artworkPath, 500) || null,
      preview_path: clean(body.previewPath, 500) || null,
      asset_path: assetPath,
      compatibility: clean(body.compatibility, 500) || null,
      licence_summary: clean(body.licenceSummary, 1000),
      licence_terms: clean(body.licenceTerms, 8000),
      packages,
      addons,
      turnaround_days:
        listingType === "service"
          ? Math.min(120, Math.max(1, Number(body.turnaroundDays) || 7))
          : null,
      revisions_included:
        listingType === "service"
          ? Math.min(20, Math.max(0, Number(body.revisionsIncluded) || 0))
          : 0,
      rights_confirmed: true,
      status: body.submit === true ? "submitted" : "draft",
      updated_at: new Date().toISOString(),
    };
    const response = await fetch(creatorUrl("creator_marketplace_listings"), {
      method: "POST",
      headers: { ...creatorHeaders, Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      return NextResponse.json(
        { error: "Could not save marketplace listing." },
        { status: 503 },
      );
    return NextResponse.json({ listing: (await response.json())[0] });
  }

  return NextResponse.json(
    { error: "Unknown marketplace action." },
    { status: 400 },
  );
}
