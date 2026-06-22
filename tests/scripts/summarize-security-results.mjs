import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const securityRoot = path.join(repoRoot, "tests", "results", "security");
const rawDir = path.join(securityRoot, "raw");
const dependencyDir = path.join(securityRoot, "dependency");
const zapDir = path.join(securityRoot, "zap");

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
};

const csvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const writeCsv = (file, header, rows) => {
  fs.writeFileSync(
    file,
    [header.join(","), ...rows.map((row) => header.map((key) => csvValue(row[key])).join(","))].join("\n"),
  );
};

const normalizeSeverity = (value) => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "moderate" || normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return "Informational";
};

const severityKey = (severity) => {
  switch (severity) {
    case "Critical":
      return "criticalFindings";
    case "High":
      return "highFindings";
    case "Medium":
      return "mediumFindings";
    case "Low":
      return "lowFindings";
    default:
      return "informationalFindings";
  }
};

ensureDir(securityRoot);

const casePayload = readJson(path.join(rawDir, "playwright-security-cases.json"), { results: [] });
const cases = Array.isArray(casePayload.results) ? casePayload.results : [];

const findings = [];
let findingCounter = 1;
const addFinding = ({ source, category, title, severity, status, affectedComponent, evidence, remediation, retestResult }) => {
  findings.push({
    finding_id: `SEC-F-${String(findingCounter).padStart(3, "0")}`,
    source,
    category,
    title,
    severity: normalizeSeverity(severity),
    status,
    affected_component: affectedComponent,
    evidence,
    remediation,
    retest_result: retestResult,
  });
  findingCounter += 1;
};

for (const item of cases) {
  if (item.result === "FAIL") {
    addFinding({
      source: "Playwright",
      category: item.category,
      title: item.title,
      severity: item.severityIfFailed,
      status: "Open",
      affectedComponent: item.endpoint,
      evidence: item.evidence,
      remediation: item.remediation,
      retestResult: "Failed",
    });
  }
}

const auditFiles = [
  ["Frontend npm audit", path.join(dependencyDir, "frontend-npm-audit.json")],
  ["Backend npm audit", path.join(dependencyDir, "backend-npm-audit.json")],
];
const dependencySummary = {};
let dependencyFindings = 0;

for (const [source, file] of auditFiles) {
  const audit = readJson(file, {});
  const vulnerabilities = audit.vulnerabilities ?? {};
  const metadata = audit.metadata?.vulnerabilities ?? {};
  dependencySummary[source] = {
    critical: Number(metadata.critical ?? 0),
    high: Number(metadata.high ?? 0),
    moderate: Number(metadata.moderate ?? 0),
    low: Number(metadata.low ?? 0),
    info: Number(metadata.info ?? 0),
    total: Number(metadata.total ?? 0),
  };
  dependencyFindings += dependencySummary[source].total;

  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    const severity = normalizeSeverity(vulnerability.severity);
    addFinding({
      source,
      category: "Dependency security",
      title: `${name} vulnerability`,
      severity,
      status: "Open",
      affectedComponent: name,
      evidence: `direct=${Boolean(vulnerability.isDirect)}; range=${vulnerability.range ?? "unknown"}`,
      remediation: vulnerability.fixAvailable
        ? `Apply available npm remediation for ${name}.`
        : `No direct safe npm remediation reported for ${name}.`,
      retestResult: "Not retested",
    });
  }
}

const secretScan = readJson(path.join(rawDir, "secret-scan.json"), {});
const secretsTracked = Number(secretScan.secretsTracked ?? 0);
if (secretsTracked > 0) {
  addFinding({
    source: "Secret scan",
    category: "Secret exposure",
    title: "Tracked environment-like file detected",
    severity: "Critical",
    status: "Open",
    affectedComponent: (secretScan.trackedEnvironmentLikeFiles ?? []).join(";"),
    evidence: `${secretsTracked} tracked environment-like file(s). Values redacted.`,
    remediation: "Remove active secret files from tracking, add ignore rules, and rotate exposed secrets if they were active.",
    retestResult: "Failed",
  });
}

const zapReport = readJson(path.join(zapDir, "zap-report.json"), {});
const zapAlerts = Array.isArray(zapReport.site)
  ? zapReport.site.flatMap((site) => site.alerts ?? [])
  : Array.isArray(zapReport.alerts)
    ? zapReport.alerts
    : [];

for (const alert of zapAlerts) {
  const risk = alert.riskdesc ?? alert.risk ?? alert.riskcode ?? "Informational";
  const severity = normalizeSeverity(String(risk).split(" ")[0]);
  addFinding({
    source: "ZAP baseline",
    category: "Passive web scan",
    title: alert.alert ?? alert.name ?? "ZAP alert",
    severity,
    status: "Open",
    affectedComponent: alert.url ?? alert.uri ?? "frontend baseline",
    evidence: alert.desc ? String(alert.desc).replace(/<[^>]+>/g, "").slice(0, 240) : "See ZAP report.",
    remediation: alert.solution ? String(alert.solution).replace(/<[^>]+>/g, "").slice(0, 240) : "Review ZAP alert.",
    retestResult: "Not retested",
  });
}

const totals = {
  totalTestCases: cases.length,
  passed: cases.filter((item) => item.result === "PASS").length,
  failed: cases.filter((item) => item.result === "FAIL").length,
  notApplicable: cases.filter((item) => item.result === "N/A").length,
  passRatePercent: cases.length ? Number(((cases.filter((item) => item.result === "PASS").length / cases.length) * 100).toFixed(2)) : 0,
  criticalFindings: 0,
  highFindings: 0,
  mediumFindings: 0,
  lowFindings: 0,
  informationalFindings: 0,
  dependencyFindings,
  zapAlerts: zapAlerts.length,
  secretsTracked,
  status: "APPROVED",
};

for (const finding of findings) {
  totals[severityKey(finding.severity)] += 1;
}

const hasOpenCriticalOrHigh = findings.some(
  (finding) =>
    finding.status === "Open" &&
    (finding.severity === "Critical" || finding.severity === "High"),
);
const authOrIsolationFailed = cases.some(
  (item) =>
    item.result === "FAIL" &&
    ["Authentication", "Authorization and RBAC", "Session and data isolation", "Gateway security", "WebSocket security", "Secret exposure"].includes(item.category),
);

if (totals.totalTestCases === 0 || hasOpenCriticalOrHigh || authOrIsolationFailed || secretsTracked > 0) {
  totals.status = "NOT APPROVED";
}

const byCategory = new Map();
for (const item of cases) {
  const current = byCategory.get(item.category) ?? {
    category: item.category,
    total: 0,
    passed: 0,
    failed: 0,
    not_applicable: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };
  current.total += 1;
  if (item.result === "PASS") current.passed += 1;
  if (item.result === "FAIL") {
    current.failed += 1;
    const sev = normalizeSeverity(item.severityIfFailed).toLowerCase();
    current[sev === "moderate" ? "medium" : sev] += 1;
  }
  if (item.result === "N/A") current.not_applicable += 1;
  byCategory.set(item.category, current);
}

for (const area of ["Dependency security", "Secret exposure", "Passive web scan"]) {
  if (!byCategory.has(area)) {
    byCategory.set(area, {
      category: area,
      total: 0,
      passed: 0,
      failed: 0,
      not_applicable: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    });
  }
}

for (const finding of findings) {
  const current = byCategory.get(finding.category);
  if (!current) continue;
  const key = finding.severity.toLowerCase() === "medium" ? "medium" : finding.severity.toLowerCase();
  if (Object.hasOwn(current, key)) {
    current[key] += 1;
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  ...totals,
  dependencySummary,
  zapStatus: fs.existsSync(path.join(zapDir, "zap-report.json"))
    ? (zapReport.status ?? "AVAILABLE")
    : "MISSING",
  methodology:
    "Security testing was performed in an isolated local test environment. Automated negative API and browser tests covered authentication, authorization, input validation, session isolation, gateway authentication, WebSocket access control, and sensitive-data exposure. Dependency auditing and a passive OWASP ZAP baseline scan complemented the application-level tests. No production environment or third-party system was targeted.",
};

fs.writeFileSync(path.join(securityRoot, "security-summary.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(securityRoot, "security-findings.json"), JSON.stringify({ findings }, null, 2));

writeCsv(
  path.join(securityRoot, "security-summary.csv"),
  ["category", "total", "passed", "failed", "not_applicable", "critical", "high", "medium", "low", "informational"],
  [...byCategory.values()],
);

writeCsv(
  path.join(securityRoot, "security-findings.csv"),
  ["finding_id", "source", "category", "title", "severity", "status", "affected_component", "evidence", "remediation", "retest_result"],
  findings,
);

writeCsv(
  path.join(securityRoot, "security-test-cases.csv"),
  ["id", "category", "title", "endpoint", "method", "role", "expected", "actualStatus", "result", "severityIfFailed", "evidence", "remediation"],
  cases,
);

console.log(`Security summary: ${summary.status} (${summary.passed}/${summary.totalTestCases} passed, ${summary.failed} failed, ${summary.notApplicable} N/A).`);
if (summary.status !== "APPROVED") {
  process.exitCode = 1;
}
