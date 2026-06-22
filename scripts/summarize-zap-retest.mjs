import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const zapDir = path.join(root, "tests", "results", "security", "zap");
const reportPath = path.join(zapDir, "zap-retest-report.json");
const summaryPath = path.join(zapDir, "zap-summary.json");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function collectAlerts(report) {
  return asArray(report.site).flatMap((site) => asArray(site.alerts));
}

if (!fs.existsSync(reportPath)) {
  console.error(`Missing ZAP retest report: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8").replace(/^\uFEFF/, ""));
const alerts = collectAlerts(report);
const openCritical = alerts.filter((alert) => Number(alert.riskcode) >= 4).length;
const openHigh = alerts.filter((alert) => Number(alert.riskcode) === 3).length;
const openMedium = alerts.filter((alert) => Number(alert.riskcode) === 2).length;
const openLow = alerts.filter((alert) => Number(alert.riskcode) === 1).length;
const openCspFindings = alerts.filter((alert) =>
  `${alert.pluginid ?? ""} ${alert.alert ?? ""} ${alert.name ?? ""}`
    .toLowerCase()
    .includes("csp"),
).length;
const openClickjackingFindings = alerts.filter((alert) =>
  `${alert.pluginid ?? ""} ${alert.alert ?? ""} ${alert.name ?? ""}`
    .toLowerCase()
    .includes("clickjacking"),
).length;

const summary = {
  generatedAt: new Date().toISOString(),
  report: path.relative(root, reportPath).replaceAll(path.sep, "/"),
  htmlReport: "tests/results/security/zap/zap-retest-report.html",
  status:
    openCritical === 0 &&
    openHigh === 0 &&
    openCspFindings === 0 &&
    openClickjackingFindings === 0
      ? "APPROVED"
      : "NOT_APPROVED",
  openCritical,
  openHigh,
  openMedium,
  openLow,
  openCspFindings,
  openClickjackingFindings,
  totalAlerts: alerts.length,
  alerts: alerts.map((alert) => ({
    pluginId: alert.pluginid,
    name: alert.name ?? alert.alert,
    riskCode: Number(alert.riskcode),
    risk: alert.riskdesc,
    count: Number(alert.count ?? asArray(alert.instances).length),
  })),
};

fs.mkdirSync(zapDir, { recursive: true });
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "APPROVED") process.exitCode = 1;
