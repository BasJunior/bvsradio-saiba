import { NextResponse } from "next/server";
import {
  creatorHeaders,
  creatorIdentity,
  creatorUrl,
} from "@/lib/creator-server";
import { r2ObjectExists, signedR2DownloadUrl } from "@/lib/r2-storage";
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
  "recording",
  "studio_session",
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

async function rows(path: string) {
  const response = await fetch(creatorUrl(path), {
    headers: creatorHeaders,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Marketplace data unavailable");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function getMarketplace(request: Request) {
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
    const images = storefrontImages(profiles[0]?.portfolio);
    const avatarUrl = ownedPath(images.avatar_path, identity.user.id) ? await signedR2DownloadUrl(images.avatar_path) : null;
    const bannerUrl = ownedPath(images.banner_path, identity.user.id) ? await signedR2DownloadUrl(images.banner_path) : null;
    const hydratedListings = await Promise.all(listings.map(async listing => ({ ...listing, artwork_url: listing.artwork_path && ownedPath(listing.artwork_path, identity.user.id) ? await signedR2DownloadUrl(listing.artwork_path) : null })));
    return NextResponse.json({
      profile: profiles[0] ? { ...profiles[0], ...images, avatar_url: avatarUrl, banner_url: bannerUrl } : null,
      seller: identity.profile || null,
      listings: hydratedListings,
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

async function postMarketplace(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const action = clean(body.action, 30);

  if (action === "save_profile") {
    const current = (await rows(`creator_marketplace_profiles?user_id=eq.${identity.user.id}&select=*&limit=1`))[0];
    const selectedRoles = list(body.roles ?? current?.roles, roles);
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
    const images = storefrontImages(current?.portfolio);
    const avatar = body.avatarPath === undefined ? images.avatar_path : clean(body.avatarPath, 500);
    const banner = body.bannerPath === undefined ? images.banner_path : clean(body.bannerPath, 500);
    const imagePaths = [avatar, banner].filter(Boolean);
    if (imagePaths.some(path => !ownedPath(path, identity.user.id) || !/-storefront_(avatar|banner)-[a-f0-9]+\.(jpg|jpeg|png|webp)$/.test(path))) return NextResponse.json({ error: "Invalid storefront image." }, { status: 400 });
    if ((await Promise.all(imagePaths.map(path => r2ObjectExists(path)))).some(exists => !exists)) return NextResponse.json({ error: "Your image upload has not finished. Try uploading it again." }, { status: 400 });
    const portfolio = (Array.isArray(body.portfolio) ? body.portfolio : current?.portfolio || []).filter((item: Record<string, unknown>) => !['storefront_avatar', 'storefront_banner'].includes(String(item?.kind))).slice(0, 24);
    if (avatar) portfolio.push({ kind: 'storefront_avatar', path: avatar });
    if (banner) portfolio.push({ kind: 'storefront_banner', path: banner });
    const payload = {
      user_id: identity.user.id,
      roles: selectedRoles,
      headline: clean(body.headline ?? current?.headline, 180),
      bio: clean(body.bio ?? current?.bio, 3000),
      experience: clean(body.experience ?? current?.experience, 3000),
      skills: list(body.skills ?? current?.skills),
      genres: list(body.genres ?? current?.genres),
      equipment: list(body.equipment ?? current?.equipment),
      software: list(body.software ?? current?.software),
      portfolio,
      credits: Array.isArray(body.credits) ? body.credits.slice(0, 24) : current?.credits || [],
      accomplishments: body.accomplishments === undefined ? current?.accomplishments || [] : accomplishments,
      status: body.submit === true ? "submitted" : "draft",
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
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
    const saved = (await response.json())[0];
    return NextResponse.json({ profile: { ...saved, ...storefrontImages(saved.portfolio) } });
  }

  if (action === "pause_listing") {
    const id = clean(body.id, 40);
    if (!uuid(id)) return NextResponse.json({ error: "Choose a listing." }, { status: 400 });
    const response = await fetch(creatorUrl(`creator_marketplace_listings?id=eq.${id}&seller_user_id=eq.${identity.user.id}`), { method: 'PATCH', headers: { ...creatorHeaders, Prefer: 'return=representation' }, body: JSON.stringify({ status: 'archived', updated_at: new Date().toISOString() }) });
    if (!response.ok) throw new Error('Listing update failed');
    const listing = (await response.json())[0];
    return listing ? NextResponse.json({ listing }) : NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  }
  if (action === "save_listing") {
    const id = clean(body.id, 40);
    if (id && !uuid(id)) return NextResponse.json({ error: 'Invalid listing.' }, { status: 400 });
    const current = id ? (await rows(`creator_marketplace_listings?id=eq.${id}&seller_user_id=eq.${identity.user.id}&select=*&limit=1`))[0] : null;
    if (id && !current) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
    const profile = (
      await rows(
        `creator_marketplace_profiles?user_id=eq.${identity.user.id}&status=eq.approved&select=user_id&limit=1`,
      )
    )[0];
    if (!profile && body.submit === true)
      return NextResponse.json(
        {
          error:
            "Editorial must approve your Creator Marketplace profile before listings can be submitted.",
        },
        { status: 403 },
      );
    const listingType = clean(body.listingType ?? current?.listing_type, 30);
    if (current && current.listing_type !== listingType) return NextResponse.json({ error: "Create a new listing to change its type." }, { status: 400 });
    if (!["digital_product", "service"].includes(listingType))
      return NextResponse.json(
        { error: "Choose product or service." },
        { status: 400 },
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
    if (body.submit === true && body.rightsConfirmed !== true)
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
    if ((!current || ["rejected", "archived"].includes(current.status)) && limit != null && existing.filter(item => item.id !== id).length >= limit)
      return NextResponse.json(
        {
          error: `${entitlements.planId} allows ${limit} active ${listingType === "service" ? "service" : "product"} listing${limit === 1 ? "" : "s"}. Upgrade or archive an existing listing.`,
        },
        { status: 409 },
      );
    const assetPath = clean(body.assetPath === undefined ? current?.asset_path : body.assetPath, 500) || null;
    const artworkPath = clean(body.artworkPath === undefined ? current?.artwork_path : body.artworkPath, 500) || null;
    const previewPath = clean(body.previewPath === undefined ? current?.preview_path : body.previewPath, 500) || null;
    if (listingType === "digital_product" && body.submit === true && !assetPath)
      return NextResponse.json(
        { error: "Upload the private product file before submitting." },
        { status: 400 },
      );
    const paths = [
      assetPath,
      artworkPath,
      previewPath,
    ].filter((path): path is string => Boolean(path));
    if (
      paths.some((path) => !ownedPath(path, identity.user.id))
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
          .map((item) => ({
            name: clean((item as Record<string, unknown>)?.name, 100),
            description: clean(
              (item as Record<string, unknown>)?.description,
              500,
            ),
            priceUsd: Math.max(
              1,
              Number((item as Record<string, unknown>)?.priceUsd) || price,
            ),
          }))
          .filter((item) => item.name)
      : current?.packages || [];
    const addons =
      entitlements.addonsEnabled && Array.isArray(body.addons)
        ? body.addons.slice(0, 12)
        : current?.addons || [];
    const payload = {
      seller_user_id: identity.user.id,
      listing_type: listingType,
      category,
      title,
      slug: current?.slug || `${slugify(title) || "listing"}-${crypto.randomUUID().slice(0, 6)}`,
      description: clean(body.description, 5000),
      price_usd: Math.round(price * 100) / 100,
      artwork_path: artworkPath,
      preview_path: previewPath,
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
      rights_confirmed: body.rightsConfirmed === true,
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      status: body.submit === true ? "submitted" : "draft",
      updated_at: new Date().toISOString(),
    };
    const response = await fetch(creatorUrl(id ? `creator_marketplace_listings?id=eq.${id}&seller_user_id=eq.${identity.user.id}` : "creator_marketplace_listings"), {
      method: id ? "PATCH" : "POST",
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

function uuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
function ownedPath(path: string, userId: string) { return path.startsWith(`marketplace/${userId}/`) && !path.includes('..') && !path.includes('?') && !path.includes('#'); }
function storefrontImages(portfolio: unknown) {
  const entries = Array.isArray(portfolio) ? portfolio : [];
  return { avatar_path: clean(entries.find(item => item?.kind === 'storefront_avatar')?.path, 500), banner_path: clean(entries.find(item => item?.kind === 'storefront_banner')?.path, 500) };
}
export async function GET(request: Request) {
  try { return await getMarketplace(request); } catch { return NextResponse.json({ error: 'Your marketplace could not be loaded. Please try again.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  try { return await postMarketplace(request); } catch { return NextResponse.json({ error: 'Your changes could not be saved. Please try again.' }, { status: 503 }); }
}
