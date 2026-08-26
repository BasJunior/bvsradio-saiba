import fs from "node:fs";

const betaProjectId = process.env.BVS_BETA_VERCEL_PROJECT_ID || "prj_gv9stqkz190faX23mT3dy3wWStEo";
const prodProjectId = process.env.BVS_PROD_VERCEL_PROJECT_ID || "prj_jdey5oej8CGAROfdPK2f5frnq2YK";
const projectPath = ".vercel/project.json";
const current = fs.existsSync(projectPath)
  ? JSON.parse(fs.readFileSync(projectPath, "utf8"))
  : {};
const targetProjectId = process.env.VERCEL_PROJECT_ID || current.projectId || "";

if (!targetProjectId) {
  throw new Error("No Vercel project target detected. Refusing beta deploy.");
}
if (targetProjectId === prodProjectId || current.projectId === prodProjectId) {
  throw new Error("Current checkout is linked to production bvsradio-saiba. Refusing beta deploy.");
}
if (targetProjectId !== betaProjectId) {
  throw new Error(`Target project ${targetProjectId} is not bvsradio-beta (${betaProjectId}).`);
}

console.log("Beta deploy guard passed.");
