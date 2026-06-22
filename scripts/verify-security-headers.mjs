import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const frontendUrl = (process.env.E2E_BASE_URL || "http://localhost:3002").replace(/\/+$/, "");
const outputPath = path.join(root, "tests", "results", "security", "security-headers.json");
const pages = ["/login", "/dashboard"];

const requiredHeaders = [
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

async function readHeaders(page) {
  const response = await fetch(`${frontendUrl}${page}`, { method: "HEAD" });
  const headers = Object.fromEntries(response.headers.entries());
  return {
    page,
    status: response.status,
    headers,
    checks: {
      cspPresent: Boolean(headers["content-security-policy"]),
      cspFrameAncestorsNone: /frame-ancestors\s+'none'/i.test(headers["content-security-policy"] ?? ""),
      xFrameOptionsDeny: /^DENY$/i.test(headers["x-frame-options"] ?? ""),
      contentTypeNosniff: /^nosniff$/i.test(headers["x-content-type-options"] ?? ""),
      referrerPolicyPresent: Boolean(headers["referrer-policy"]),
      permissionsPolicyPresent: Boolean(headers["permissions-policy"]),
      requiredHeadersPresent: requiredHeaders.every((header) => Boolean(headers[header])),
    },
  };
}

const results = [];
for (const page of pages) {
  results.push(await readHeaders(page));
}

const approved = results.every(
  (result) =>
    result.status >= 200 &&
    result.status < 400 &&
    result.checks.cspPresent &&
    result.checks.cspFrameAncestorsNone &&
    result.checks.xFrameOptionsDeny &&
    result.checks.contentTypeNosniff &&
    result.checks.referrerPolicyPresent &&
    result.checks.permissionsPolicyPresent &&
    result.checks.requiredHeadersPresent,
);

const output = {
  generatedAt: new Date().toISOString(),
  frontendUrl,
  approved,
  results,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (!approved) process.exitCode = 1;
