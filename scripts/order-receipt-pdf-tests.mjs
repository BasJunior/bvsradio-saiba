import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");

const pkg = JSON.parse(read("package.json"));
const page = read("src/app/account/orders/[reference]/page.tsx");
const route = read("src/app/api/account/orders/[reference]/receipt/route.ts");
const mailer = read("src/lib/mailer.ts");
const orders = read("src/lib/orders.ts");
const pdf = read("src/lib/order-receipt-pdf.ts");

assert(pkg.dependencies?.["pdf-lib"], "pdf-lib dependency is installed");
assert(page.includes("Download receipt PDF"), "paid order page exposes receipt PDF download");
assert(page.includes("/receipt"), "order page calls authenticated receipt endpoint");
assert(page.includes("Authorization"), "order page sends auth token for receipt PDF");

assert(route.includes("Authorization"), "receipt endpoint requires bearer auth");
assert(route.includes("application/pdf"), "receipt endpoint returns PDF content type");
assert(route.includes("Content-Disposition"), "receipt endpoint returns downloadable filename");
assert(route.includes("buildOrderReceiptPdf"), "receipt endpoint builds receipt from order truth");

assert(pdf.includes("PDFDocument"), "receipt generator uses a real PDF document");
assert(pdf.includes("receiptInputFromStoredOrder"), "receipt generator maps stored order truth");
assert(pdf.includes("Total paid"), "receipt PDF contains paid total");
assert(pdf.includes("Payment details"), "receipt PDF contains payment details");

assert(mailer.includes("attachments"), "mailer supports attachments");
assert(orders.includes("receiptPdfFilename"), "paid order email builds PDF receipt attachment");
assert(orders.includes('contentType: "application/pdf"'), "paid order email attaches PDF MIME type");

console.log("order receipt PDF checks passed");
