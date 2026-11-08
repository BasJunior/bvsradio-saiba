import { NextResponse } from "next/server";
import {
  audit,
  can,
  editorialIdentity,
  editorialUrl,
  serviceHeaders,
} from "@/lib/editorial-server";
import { csvDocument } from "@/lib/csv";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;
const HEADER = ["created_at", "order_reference", "seller", "provider", "seller_plan", "gross_product_revenue", "platform_fee", "processor_fee", "processor_fee_status", "seller_net", "settlement_status", "policy_version"];

async function rows(path: string): Promise<Row[]> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: "no-store" });
  if (!response.ok) throw new Error("Finance export unavailable");
  return (await response.json()) as Row[];
}

async function allSettlements() {
  const result: Row[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const page = await rows(`commerce_seller_settlements?select=*&order=created_at.desc,id.asc&limit=${PAGE_SIZE}&offset=${offset}`);
    result.push(...page);
    if (page.length < PAGE_SIZE) return result;
  }
  throw new Error("Finance export too large");
}

async function sellerNames(ids: string[]) {
  const people = new Map<string, string>();
  const unique = [...new Set(ids)];
  for (let index = 0; index < unique.length; index += 100) {
    const batch = unique.slice(index, index + 100);
    const found = await rows(`profiles?id=in.(${batch.join(",")})&select=id,username,display_name,creator_public_name`);
    for (const item of found) people.set(String(item.id), String(item.creator_public_name || item.display_name || item.username || ""));
  }
  return people;
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return NextResponse.json({ error: "Active Editorial staff access is required." }, { status: 403 });
  if (!can(identity, "manage_artist_wallet"))
    return NextResponse.json({ error: "The finance export needs finance access." }, { status: 403 });

  try {
    const settlements = await allSettlements();
    const people = await sellerNames(settlements.map((row) => String(row.seller_user_id)));
    const number = (value: unknown) => (value === null || value === undefined ? "" : Number(value));
    const csv = csvDocument(
      HEADER,
      settlements.map((row) => [
        row.created_at,
        row.order_reference,
        people.get(String(row.seller_user_id)) || "",
        row.provider,
        row.seller_plan_id,
        number(row.gross_product_revenue),
        number(row.platform_fee_amount),
        number(row.processor_fee_allocated),
        row.processor_fee_status,
        number(row.seller_net),
        row.settlement_status,
        row.policy_version,
      ]),
    );
    await audit(identity.user.id, "finance_settlements_exported", "commerce_seller_settlements", "all", { rows: settlements.length });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bvs-settlements-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "The finance export could not be created. Please try again." }, { status: 503 });
  }
}
