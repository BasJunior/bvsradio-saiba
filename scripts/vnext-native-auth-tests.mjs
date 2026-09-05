import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const bootstrap = read("src/components/app-vnext/AppBootstrap.tsx");
const login = read("src/components/app-vnext/AppLoginClient.tsx");
const join = read("src/app/app/[surface]/join/page.tsx");
const signup = read("src/components/app-vnext/AppSignupClient.tsx");

assert.match(bootstrap, /path === "\/auth\/login"[\s\S]*`\/app\/\$\{surface\}\/login/);
assert.match(bootstrap, /path === "\/auth\/signup"[\s\S]*`\/app\/\$\{surface\}\/join\/email`/);
assert.match(bootstrap, /path === "\/auth\/forgot-password"[\s\S]*`\/app\/\$\{surface\}\/forgot-password`/);
assert.match(login, /fetch\("\/api\/auth\/login"/);
assert.match(login, /createClient\(\)\.auth\.setSession/);
assert.match(login, /router\.replace\(next\)/);
assert.doesNotMatch(join, /href=\{`\/auth\/login/);
assert.doesNotMatch(signup, /href=\{`\/auth\/login/);

console.log("vNext native authentication routing checks passed");
