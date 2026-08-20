import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(root, "src/app/api/artist/premium/subscribe/route.ts"), "utf8");
const saveIdx = src.indexOf("saveOrderToSupabase");
const sendIdx = src.indexOf("paynow.send");
const failClosed = src.includes("premium_order_save_failed");

const failures = [];
if (saveIdx < 0) failures.push("subscribe route missing saveOrderToSupabase");
if (sendIdx < 0) failures.push("subscribe route missing paynow.send");
if (saveIdx > sendIdx) failures.push("ZVSJQ regression: Paynow send happens before durable save");
if (!failClosed) failures.push("subscribe route missing fail-closed premium_order_save_failed");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("premium-order-save-tests: save-before-Paynow contract holds");
