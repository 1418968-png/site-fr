import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const requiredFiles = [
  "index.html",
  "sector.html",
  "company.html",
  "screener.html",
  "methodology.html",
  "css/style.css",
  "data/sectors.json",
  "data/companies.json",
  "data/market-data.json",
  "data/price-history.json",
  "js/api.js",
  "js/charts.js",
  "js/vendor/chart.umd.js",
  "scripts/market-sources.config.mjs",
  "scripts/update-market-data.mjs",
  ".github/workflows/update-market-data.yml"
];

const obsoleteFiles = [
  "smartlab.html",
  "js/smartlab.js",
  "data/smartlab-mobile.json",
  "scripts/update-smartlab-mobile.mjs",
  ".github/workflows/update-smartlab-mobile.yml"
];

const expectedSectorSlugs = [
  "banks",
  "oilgas",
  "metals",
  "tech",
  "energy",
  "consumer",
  "realestate",
  "telecom",
  "finance",
  "transport",
  "chemistry",
  "other"
];

const forbiddenDataFields = [
  "sourceUrl",
  "externalUrl",
  "smartlabUrl",
  "urlInternal"
];

const serviceWorkerPatterns = [
  /navigator\.serviceWorker/i,
  /serviceWorker\.register/i,
  /\bworkbox\b/i,
  /\bnext-pwa\b/i,
  /\bvite-plugin-pwa\b/i,
  /<link[^>]+rel=["']manifest["']/i
];

const forbiddenFrontendPatterns = [
  /\bSmart-Lab\b/i,
  /\bsmartlab\b/i,
  /Источник/i,
  /Открыть оригинал/i,
  /Читать на/i,
  /Данные пока недоступны/i,
  /\bTradingView\b/i,
  /<iframe\b/i,
  /target=["']_blank["']/i,
  /fetch\(["']\/data\//i
];

await assertRequiredFiles();
await assertObsoleteFilesMissing();
await validateJsonFiles();
await validateDataShape();
await validateJavaScriptSyntax();
await assertNoDevelopmentPwa();
await assertNoForbiddenFrontendText();

console.log("[validate-static] Static project checks passed.");

async function assertRequiredFiles() {
  for (const relativePath of requiredFiles) {
    const fileStat = await stat(path.join(rootDir, relativePath));
    if (!fileStat.isFile()) {
      throw new Error(`Required file is missing: ${relativePath}`);
    }
  }
}

async function assertObsoleteFilesMissing() {
  for (const relativePath of obsoleteFiles) {
    try {
      const fileStat = await stat(path.join(rootDir, relativePath));
      if (fileStat.isFile()) {
        throw new Error(`Obsolete file must not be present: ${relativePath}`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function validateJsonFiles() {
  const dataDir = path.join(rootDir, "data");
  const files = await readdir(dataDir);

  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const relativePath = path.join("data", file);
    const raw = await readFile(path.join(rootDir, relativePath), "utf8");
    JSON.parse(raw);
  }
}

async function validateDataShape() {
  const sectors = await readJson("data/sectors.json");
  const companies = await readJson("data/companies.json");
  const marketData = await readJson("data/market-data.json");
  const priceHistory = await readJson("data/price-history.json");

  const sectorSlugs = sectors.map((sector) => sector.slug);
  if (JSON.stringify(sectorSlugs) !== JSON.stringify(expectedSectorSlugs)) {
    throw new Error(`Unexpected sector slugs: ${sectorSlugs.join(", ")}`);
  }

  if ("markets" in marketData) {
    throw new Error("data/market-data.json must not contain legacy markets field.");
  }

  for (const field of ["updatedAt", "instruments", "indices", "currencies", "futures", "bonds", "funds"]) {
    if (!(field in marketData)) {
      throw new Error(`data/market-data.json is missing field: ${field}`);
    }
  }

  if (!priceHistory || typeof priceHistory !== "object" || Array.isArray(priceHistory)) {
    throw new Error("data/price-history.json must be an object keyed by ticker.");
  }

  if ("instruments" in priceHistory) {
    throw new Error("data/price-history.json must be keyed directly by ticker, without instruments wrapper.");
  }

  for (const [ticker, series] of Object.entries(priceHistory)) {
    if (!/^[A-Z0-9]{1,12}$/.test(ticker) || !Array.isArray(series)) {
      throw new Error(`Invalid price history series for ticker: ${ticker}`);
    }
  }

  assertNoForbiddenDataFields(companies, "data/companies.json");
  assertNoForbiddenDataFields(marketData, "data/market-data.json");
}

function assertNoForbiddenDataFields(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenDataFields(item, `${label}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const key of Object.keys(value)) {
    if (forbiddenDataFields.includes(key)) {
      throw new Error(`Forbidden data field ${key} found in ${label}.`);
    }
    assertNoForbiddenDataFields(value[key], `${label}.${key}`);
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(rootDir, relativePath), "utf8"));
}

async function validateJavaScriptSyntax() {
  const jsFiles = [
    ...(await listFiles(path.join(rootDir, "js"), ".js")),
    ...(await listFiles(path.join(rootDir, "scripts"), ".mjs"))
  ];

  for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: rootDir,
      encoding: "utf8"
    });

    if (result.status !== 0) {
      throw new Error(`JavaScript syntax check failed for ${path.relative(rootDir, file)}\n${result.stderr}`);
    }
  }
}

async function assertNoDevelopmentPwa() {
  const scannedFiles = [
    ...(await listFiles(rootDir, ".html")),
    ...(await listFiles(path.join(rootDir, "js"), ".js"))
  ];

  for (const file of scannedFiles) {
    const source = await readFile(file, "utf8");
    const matchedPattern = serviceWorkerPatterns.find((pattern) => pattern.test(source));

    if (matchedPattern) {
      throw new Error(
        `PWA/Service Worker code is enabled in development: ${path.relative(rootDir, file)} matched ${matchedPattern}`
      );
    }
  }
}

async function assertNoForbiddenFrontendText() {
  const scannedFiles = [
    ...(await listFiles(rootDir, ".html")),
    ...(await listFiles(path.join(rootDir, "js"), ".js"))
  ];

  for (const file of scannedFiles) {
    const source = await readFile(file, "utf8");
    const matchedPattern = forbiddenFrontendPatterns.find((pattern) => pattern.test(source));

    if (matchedPattern) {
      throw new Error(
        `Forbidden frontend text or widget marker found: ${path.relative(rootDir, file)} matched ${matchedPattern}`
      );
    }
  }
}

async function listFiles(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) continue;
    if (entry.isFile() && entry.name.endsWith(extension)) files.push(fullPath);
  }

  return files;
}
