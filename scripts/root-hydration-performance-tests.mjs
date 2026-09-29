import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const deferredGlobal = await readFile(new URL("../src/components/layout/DeferredGlobalTools.tsx", import.meta.url), "utf8");
const deferredEditorial = await readFile(new URL("../src/components/layout/DeferredEditorialTools.tsx", import.meta.url), "utf8");
const navbar = await readFile(new URL("../src/components/layout/Navbar.tsx", import.meta.url), "utf8");
const search = await readFile(new URL("../src/components/layout/HeaderSearch.tsx", import.meta.url), "utf8");

for (const eager of [
  '@/components/VisitorAssistant',
  '@/components/PwaRegister',
  '@/components/EditorialCommandCenter',
  '@/components/EditorialWorkBridge',
  '@/components/EditorialWorkspaceNav',
]) {
  assert.ok(
    !layout.includes(`import ${eager}`) && !layout.includes(`from "${eager}"`),
    `Root layout must not eagerly import ${eager}.`,
  );
}

assert.ok(
  layout.includes("<DeferredEditorialTools />") &&
    layout.includes("<DeferredGlobalTools />"),
  "Root layout must use deferred shells for non-critical global/editorial tools.",
);

for (const modulePath of [
  "@/components/VisitorAssistant",
  "@/components/PwaRegister",
]) {
  assert.ok(
    deferredGlobal.includes(`dynamic(() => import("${modulePath}")`) &&
      deferredGlobal.includes("ssr: false"),
    `${modulePath} must stay in a separate client chunk.`,
  );
}

assert.ok(
  deferredGlobal.includes("requestIdleCallback") &&
    deferredGlobal.includes("timeout: 1500") &&
    deferredGlobal.includes("setTimeout(activate, 900)"),
  "Non-critical global tools must wait for browser idle with a bounded fallback.",
);

for (const modulePath of [
  "@/components/EditorialCommandCenter",
  "@/components/EditorialWorkBridge",
  "@/components/EditorialWorkspaceNav",
]) {
  assert.ok(
    deferredEditorial.includes(`dynamic(() => import("${modulePath}")`) &&
      deferredEditorial.includes("ssr: false"),
    `${modulePath} must stay out of non-editorial route bundles.`,
  );
}
assert.ok(
  deferredEditorial.includes("isEditorialPath") &&
    deferredEditorial.includes("if (!isEditorialPath(pathname)) return null"),
  "Editorial-only chunks must not mount on listener routes.",
);

assert.ok(
  navbar.includes("const [authToken, setAuthToken]") &&
    navbar.includes("setAuthToken(token || null)") &&
    navbar.includes("!user?.id || !authToken"),
  "Navbar notification work must reuse the already-resolved auth token.",
);
assert.ok(
  !navbar.includes("const { data } = await createClient().auth.getSession()"),
  "Notification polling must not perform a second auth-session lookup.",
);
assert.ok(
  navbar.includes("requestIdleCallback(startPolling") &&
    navbar.includes("timeout: 2000") &&
    navbar.includes("setTimeout(startPolling, 1200)"),
  "Notification polling must be deferred until idle instead of competing with first interaction.",
);
assert.ok(
  navbar.includes("window.setInterval(() => void seen(), 60000)"),
  "Deferred notifications must retain the existing one-minute refresh cadence.",
);

assert.ok(
  search.includes("if (!open || query.trim().length < 2 || loadedSurface === surfaceKey) return"),
  "Header search catalogue requests must wait for real search intent.",
);
assert.ok(
  search.includes("if (iconOnly) return") &&
    search.includes("if (!open) return") &&
    search.includes('document.addEventListener("pointerdown", outside)'),
  "Closed mobile search must not install unnecessary global keyboard/outside-click listeners.",
);

assert.ok(
  navbar.includes("scheduleHeaderIdleWork(run)") &&
    navbar.includes("event === 'INITIAL_SESSION'") &&
    navbar.includes("scheduleHeaderIdleWork(startCartSync)"),
  "Initial access enrichment and cart bookkeeping must stay off the critical header frame.",
);

assert.ok(
  layout.includes("<PersistentPlayer />") &&
    layout.includes("<AnalyticsBootstrap />"),
  "Critical playback and listener analytics must remain eager while non-critical tools are deferred.",
);

console.log("root hydration performance gates passed");
