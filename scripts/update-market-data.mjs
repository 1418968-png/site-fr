import * as cheerio from "cheerio";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { MARKET_SOURCES } from "./market-sources.config.mjs";

const USER_AGENT = "InvestmentWebsiteBot/1.0 educational project contact: none";
const REQUEST_TIMEOUT_MS = 20000;
const MIN_COMPANIES_FOR_FULL_UPDATE = 50;
const ALLOW_SMALL_UPDATE_IF_NO_EXISTING_FILE = true;

const OUTPUT_FILES = {
  marketData: path.resolve("data", "market-data.json"),
  companies: path.resolve("data", "companies.json"),
  sectors: path.resolve("data", "sectors.json"),
  priceHistory: path.resolve("data", "price-history.json")
};

const SECTOR_MAP = {
  banks: {
    title: "Банки",
    tickers: ["SBER", "SBERP", "VTBR", "TCSG", "T", "BSPB", "CBOM", "MBNK", "SVCB", "RENI"]
  },
  oilgas: {
    title: "Нефть и газ",
    tickers: ["GAZP", "LKOH", "ROSN", "NVTK", "SNGS", "SNGSP", "TATN", "TATNP", "TRNFP", "RNFT"]
  },
  metals: {
    title: "Металлурги",
    tickers: ["GMKN", "NLMK", "CHMF", "MAGN", "RUAL", "ALRS", "PLZL", "SELG", "UGLD", "VSMO", "POLY"]
  },
  tech: {
    title: "Технологии",
    tickers: ["YDEX", "VKCO", "OZON", "HEAD", "ASTR", "POSI", "DIAS", "SOFL", "CARM", "WUSH"]
  },
  telecom: {
    title: "Телеком",
    tickers: ["MTSS", "RTKM", "RTKMP", "VEON"]
  },
  energy: {
    title: "Энергетика",
    tickers: ["HYDR", "IRAO", "FEES", "UPRO", "OGKB", "TGKA", "MSNG", "MRKC", "MRKP", "MRKV", "MRKZ", "MRKU", "LSNG", "LSNGP"]
  },
  consumer: {
    title: "Потребительский сектор",
    tickers: ["MGNT", "FIVE", "X5", "FIXP", "LENT", "BELU", "MVID", "HHRU", "OKEY", "ABRD", "AQUA", "RAGR", "GCHE"]
  },
  realestate: {
    title: "Недвижимость",
    tickers: ["PIKK", "LSRG", "SMLT", "ETLN", "SVCB"]
  },
  finance: {
    title: "Финансы",
    tickers: ["MOEX", "SPBE", "AFKS", "RENI"]
  },
  transport: {
    title: "Транспорт",
    tickers: ["AFLT", "FESH", "NMTP", "GLTR", "FLOT"]
  },
  chemistry: {
    title: "Химия и удобрения",
    tickers: ["PHOR", "AKRN", "KAZT", "KAZTP", "NKNC", "NKNCP", "KMAZ", "KZOS", "KZOSP"]
  },
  other: {
    title: "Прочие компании",
    tickers: []
  }
};

const SECTOR_META = {
  banks: "Банковский сектор и финансовые организации.",
  oilgas: "Нефтегазовые компании.",
  metals: "Металлургия, добыча и производство металлов.",
  tech: "IT, интернет-компании и технологические бизнесы.",
  energy: "Электроэнергетика, генерация и сети.",
  consumer: "Ритейл, товары и потребительские сервисы.",
  realestate: "Девелоперы и компании рынка недвижимости.",
  telecom: "Телекоммуникационные компании.",
  finance: "Биржи, брокеры, финансовые сервисы и холдинги.",
  transport: "Авиаперевозки, порты, логистика и транспорт.",
  chemistry: "Химические компании и производители удобрений.",
  other: "Компании, которые пока не распределены по основным секторам."
};

const SECTOR_ORDER = [
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

const EMPTY_MARKET_DATA = {
  updatedAt: null,
  instruments: [],
  indices: [],
  currencies: [],
  futures: [],
  bonds: [],
  funds: []
};

const DIAGNOSTIC_TICKERS = [
  "SBER",
  "VTBR",
  "LKOH",
  "GAZP",
  "ROSN",
  "NVTK",
  "YDEX",
  "ALRS",
  "GMKN",
  "NLMK",
  "RUAL",
  "MOEX",
  "MTSS",
  "AFLT"
];

async function main() {
  const existingCompanies = await safeReadJson(OUTPUT_FILES.companies, null);
  const existingCompaniesAvailable = Array.isArray(existingCompanies) && existingCompanies.length > 0;
  const sources = getEnabledSources();
  const diagnostics = [];
  const quoteCompanies = [];
  const fundamentalCompanies = [];

  for (const source of sources) {
    try {
      const html = await fetchHtml(source.url);
      let rows = [];

      if (source.role === "main_companies_list" || source.role === "sector_quotes") {
        rows = parseQuotesPage(html);
        quoteCompanies.push(...rows);
      } else if (source.role === "fundamentals") {
        rows = parseFundamentalsPage(html);
        fundamentalCompanies.push(...rows);
      }

      diagnostics.push({
        key: source.key,
        role: source.role,
        url: source.url,
        rows: rows.length,
        status: "ok"
      });
    } catch (error) {
      diagnostics.push({
        key: source.key,
        role: source.role,
        url: source.url,
        rows: 0,
        status: `error: ${error.message}`
      });
      console.warn(`[market-data] ${source.key}: ${error.message}`);
    }
  }

  const quotes = uniqueByTicker(quoteCompanies);
  const fundamentals = uniqueByTicker(fundamentalCompanies);
  const mergedCompanies = mergeCompaniesByTicker(quotes, fundamentals);

  if (mergedCompanies.length < MIN_COMPANIES_FOR_FULL_UPDATE) {
    logDiagnostics({
      diagnostics,
      quotes,
      fundamentals,
      mergedCompanies,
      savedCompanies: existingCompaniesAvailable ? existingCompanies : mergedCompanies
    });
    console.warn("[market-data] Найдено слишком мало компаний. Полное обновление не подтверждено.");

    if (existingCompaniesAvailable) {
      console.warn("[market-data] Найдено слишком мало компаний. Старый файл companies.json сохранён.");
      return;
    }

    if (!ALLOW_SMALL_UPDATE_IF_NO_EXISTING_FILE) {
      console.warn("[market-data] Старого файла companies.json нет, малую выгрузку сохранять запрещено.");
      return;
    }

    console.warn("[market-data] Старого файла companies.json нет. Малая выгрузка сохранена с предупреждением.");
  }

  const now = new Date().toISOString();
  const companies = mergedCompanies.sort(sortCompanies);
  const sectors = buildSectors();
  const marketData = {
    ...EMPTY_MARKET_DATA,
    updatedAt: now,
    instruments: companies.map(toMarketInstrument)
  };
  const priceHistory = await updatePriceHistory(companies, now);

  await Promise.all([
    safeWriteJson(OUTPUT_FILES.marketData, marketData),
    safeWriteJson(OUTPUT_FILES.companies, companies),
    safeWriteJson(OUTPUT_FILES.sectors, sectors),
    safeWriteJson(OUTPUT_FILES.priceHistory, priceHistory)
  ]);

  logDiagnostics({
    diagnostics,
    quotes,
    fundamentals,
    mergedCompanies,
    savedCompanies: companies
  });

  if (companies.length >= MIN_COMPANIES_FOR_FULL_UPDATE) {
    console.log("[market-data] JSON updated.");
  }
}

function getEnabledSources() {
  const sources = [];

  for (const key of ["shares", "fundamentals", "mobile"]) {
    const source = MARKET_SOURCES[key];
    if (source?.enabled && source.url) {
      sources.push({
        key,
        url: source.url,
        role: source.role || key
      });
    }
  }

  for (const page of MARKET_SOURCES.sectorPages || []) {
    if (page?.enabled && page.url) {
      sources.push({
        key: `sector:${page.slug}`,
        url: page.url,
        role: "sector_quotes"
      });
    }
  }

  return sources;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ru,en;q=0.8"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`timeout ${REQUEST_TIMEOUT_MS} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseQuotesPage(html) {
  const $ = cheerio.load(html);
  const companies = [];

  $("table").each((_, table) => {
    const $table = $(table);
    const headers = detectTableHeaders($table, $);
    const tickerIndex = findColumnIndex(headers, "ticker");
    const nameIndex = findColumnIndex(headers, "name");
    const priceIndex = findColumnIndex(headers, "price");

    if (tickerIndex < 0 || nameIndex < 0 || priceIndex < 0) return;

    const changePercentIndex = findColumnIndex(headers, "changePercent");
    const volumeIndex = findColumnIndex(headers, "volume");
    const marketCapIndex = findColumnIndex(headers, "marketCap");

    for (const row of extractRowsFromTable($, $table)) {
      const ticker = normalizeTicker(cellAt(row.cells, tickerIndex));
      const name = normalizeCompanyName(cellAt(row.cells, nameIndex));

      if (!isValidCompanyTicker(ticker) || !isCompanyName(name, ticker)) continue;

      const price = cleanText(cellAt(row.cells, priceIndex));
      const changePercent = cleanText(cellAt(row.cells, changePercentIndex));

      companies.push({
        name,
        ticker,
        price,
        change: changePercent,
        changePercent,
        volume: cleanText(cellAt(row.cells, volumeIndex)),
        marketCap: cleanText(cellAt(row.cells, marketCapIndex)),
        pe: null,
        pb: null,
        roe: null,
        dividendYield: null,
        dividendYieldPref: null,
        debtLevel: null,
        evEbitda: null
      });
    }
  });

  return uniqueByTicker(companies);
}

function parseFundamentalsPage(html) {
  const $ = cheerio.load(html);
  const companies = [];

  $("table").each((_, table) => {
    const $table = $(table);
    const headers = detectTableHeaders($table, $);
    const tickerIndex = findColumnIndex(headers, "ticker");

    if (tickerIndex < 0) return;

    const nameIndex = findColumnIndex(headers, "name");
    const marketCapIndex = findColumnIndex(headers, "marketCap");
    const peIndex = findColumnIndex(headers, "pe");
    const pbIndex = findColumnIndex(headers, "pb");
    const roeIndex = findColumnIndex(headers, "roe");
    const roaIndex = findColumnIndex(headers, "roa");
    const dividendYieldIndex = findColumnIndex(headers, "dividendYield");
    const dividendYieldPrefIndex = findColumnIndex(headers, "dividendYieldPref");
    const debtLevelIndex = findColumnIndex(headers, "debtLevel");
    const evEbitdaIndex = findColumnIndex(headers, "evEbitda");

    for (const row of extractRowsFromTable($, $table)) {
      const ticker = normalizeTicker(cellAt(row.cells, tickerIndex));
      const name = normalizeCompanyName(cellAt(row.cells, nameIndex));

      if (!isValidCompanyTicker(ticker)) continue;

      companies.push({
        name,
        ticker,
        marketCap: cleanText(cellAt(row.cells, marketCapIndex)),
        pe: parseNumberLikeText(cellAt(row.cells, peIndex)),
        pb: parseNumberLikeText(cellAt(row.cells, pbIndex)),
        roe: parsePercent(cellAt(row.cells, roeIndex)),
        roa: parsePercent(cellAt(row.cells, roaIndex)),
        dividendYield: parsePercent(cellAt(row.cells, dividendYieldIndex)),
        dividendYieldPref: parsePercent(cellAt(row.cells, dividendYieldPrefIndex)),
        debtLevel: parseNumberLikeText(cellAt(row.cells, debtLevelIndex)),
        evEbitda: parseNumberLikeText(cellAt(row.cells, evEbitdaIndex))
      });
    }
  });

  return uniqueByTicker(companies);
}

function detectTableHeaders($table, $) {
  const rows = $table.find("tr").toArray();

  for (const row of rows.slice(0, 8)) {
    const cells = $(row)
      .children("th,td")
      .map((_, cell) => cleanText($(cell).text()))
      .get();

    if (cells.some((cell) => isHeaderCell(cell)) && cells.some((cell) => normalizeHeader(cell).includes("тикер"))) {
      return cells;
    }
  }

  const firstRow = rows[0];
  if (!firstRow) return [];

  return $(firstRow)
    .children("th,td")
    .map((_, cell) => cleanText($(cell).text()))
    .get();
}

function extractRowsFromTable($, $table) {
  const headers = detectTableHeaders($table, $);
  const headerKey = headers.map(normalizeHeader).join("|");
  const rows = [];

  $table.find("tr").each((_, row) => {
    const cells = $(row)
      .children("th,td")
      .map((__, cell) => cleanText($(cell).text()))
      .get();

    if (cells.length === 0) return;
    if (cells.map(normalizeHeader).join("|") === headerKey) return;
    if (cells.every((cell) => !cleanText(cell))) return;

    rows.push({ headers, cells });
  });

  return rows;
}

function mergeCompaniesByTicker(quotesCompanies, fundamentalCompanies) {
  const fundamentalsByTicker = new Map();

  for (const company of fundamentalCompanies) {
    const ticker = normalizeTicker(company.ticker);
    if (!ticker) continue;
    const existing = fundamentalsByTicker.get(ticker);
    fundamentalsByTicker.set(ticker, existing ? mergeCompanyData(existing, company) : company);
  }

  return quotesCompanies
    .map((quote) => mergeCompanyData(quote, fundamentalsByTicker.get(normalizeTicker(quote.ticker))))
    .filter((company) => company.name && company.ticker)
    .map((company) => ({
      ...company,
      score: calculateScore(company)
    }));
}

function mergeCompanyData(base, extra = {}) {
  const ticker = normalizeTicker(base?.ticker || extra?.ticker);
  const sector = classifyCompanyByTicker(ticker);

  return {
    name: cleanText(base?.name || extra?.name || ticker),
    ticker,
    sector: sector.title,
    sectorSlug: sector.slug,
    description: "",
    price: cleanText(base?.price),
    change: cleanText(base?.change || base?.changePercent),
    changePercent: cleanText(base?.changePercent || base?.change),
    pe: firstMetric(extra?.pe, base?.pe),
    pb: firstMetric(extra?.pb, base?.pb),
    roe: firstMetric(extra?.roe, base?.roe),
    roa: firstMetric(extra?.roa, base?.roa),
    dividendYield: firstMetric(extra?.dividendYield, base?.dividendYield),
    dividendYieldPref: firstMetric(extra?.dividendYieldPref, base?.dividendYieldPref),
    marketCap: chooseMoreInformativeValue(base?.marketCap, extra?.marketCap),
    volume: cleanText(base?.volume),
    debtLevel: firstMetric(extra?.debtLevel, base?.debtLevel),
    evEbitda: firstMetric(extra?.evEbitda, base?.evEbitda),
    score: 0,
    strengths: [],
    risks: [],
    conclusion: ""
  };
}

function classifyCompanyByTicker(ticker) {
  const normalizedTicker = normalizeTicker(ticker);

  for (const slug of SECTOR_ORDER) {
    const sector = SECTOR_MAP[slug];
    if (sector?.tickers.includes(normalizedTicker)) {
      return { slug, title: sector.title };
    }
  }

  return { slug: "other", title: SECTOR_MAP.other.title };
}

function calculateScore(company) {
  let score = 0;
  const changePercent = parsePercent(company.changePercent || company.change);
  const pe = parseNumberLikeText(company.pe);
  const pb = parseNumberLikeText(company.pb);
  const roe = parsePercent(company.roe);
  const dividendYield = parsePercent(company.dividendYield);
  const marketCap = parseNumberLikeText(company.marketCap);
  const debtLevel = parseNumberLikeText(company.debtLevel);

  if (Number.isFinite(changePercent) && changePercent > 0) score += 10;
  if (Number.isFinite(pe) && pe > 0 && pe < 10) score += 20;
  else if (Number.isFinite(pe) && pe >= 10 && pe <= 20) score += 10;
  if (Number.isFinite(pb) && pb > 0 && pb < 2) score += 10;
  if (Number.isFinite(roe) && roe > 15) score += 20;
  if (Number.isFinite(dividendYield) && dividendYield > 5) score += 15;
  if (Number.isFinite(marketCap) && marketCap > 0) score += 5;
  if (Number.isFinite(debtLevel) && debtLevel < 3) score += 10;

  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function updatePriceHistory(companies, updatedAt = new Date().toISOString()) {
  const existing = await safeReadJson(OUTPUT_FILES.priceHistory, {});
  const history = normalizePriceHistory(existing);
  const today = updatedAt.slice(0, 10);

  for (const company of companies) {
    const ticker = normalizeTicker(company.ticker);
    const price = parsePriceToNumber(company.price);
    if (!ticker || !Number.isFinite(price)) continue;

    const series = Array.isArray(history[ticker]) ? [...history[ticker]] : [];
    const sameDayIndex = series.findIndex((point) => cleanText(point?.date).slice(0, 10) === today);
    const point = { date: updatedAt, price };

    if (sameDayIndex >= 0) {
      series[sameDayIndex] = point;
    } else {
      series.push(point);
    }

    history[ticker] = series
      .filter((item) => cleanText(item?.date) && Number.isFinite(Number(item?.price)))
      .sort((a, b) => cleanText(a.date).localeCompare(cleanText(b.date)))
      .slice(-365);
  }

  return Object.fromEntries(Object.entries(history).sort(([a], [b]) => a.localeCompare(b, "ru")));
}

function uniqueByTicker(items) {
  const byTicker = new Map();

  for (const item of items) {
    const ticker = normalizeTicker(item?.ticker);
    if (!ticker) continue;
    const normalizedItem = { ...item, ticker };
    const existing = byTicker.get(ticker);
    byTicker.set(ticker, existing ? mergeCompanyData(existing, normalizedItem) : normalizedItem);
  }

  return [...byTicker.values()];
}

async function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function safeWriteJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

function buildSectors() {
  return SECTOR_ORDER.map((slug) => ({
    slug,
    title: SECTOR_MAP[slug].title,
    description: SECTOR_META[slug]
  }));
}

function toMarketInstrument(company) {
  return {
    name: company.name,
    ticker: company.ticker,
    sectorSlug: company.sectorSlug,
    sectorName: company.sector,
    price: company.price,
    change: company.change,
    changePercent: company.changePercent,
    volume: company.volume,
    marketCap: company.marketCap,
    pe: company.pe,
    pb: company.pb,
    roe: company.roe,
    roa: company.roa,
    dividendYield: company.dividendYield,
    dividendYieldPref: company.dividendYieldPref,
    debtLevel: company.debtLevel,
    evEbitda: company.evEbitda,
    score: company.score
  };
}

function findColumnIndex(headers, field) {
  const matcher = COLUMN_MATCHERS[field];
  if (!matcher) return -1;
  return headers.findIndex((header) => matcher(normalizeHeader(header)));
}

const COLUMN_MATCHERS = {
  name: (header) => header === "название" || header === "компания",
  ticker: (header) => header === "тикер",
  price: (header) => header.includes("цена") || header === "посл" || header.includes("посл"),
  changePercent: (header) => header.includes("изм") && header.includes("%") && !header.includes("объем") && !header.includes("объём"),
  volume: (header) => (header.includes("объем") || header.includes("объём")) && !header.includes("изм"),
  marketCap: (header) => header.includes("капит") && !header.includes("$"),
  pe: (header) => header === "p/e",
  pb: (header) => header === "p/b" || header === "p/bv",
  roe: (header) => header === "roe",
  roa: (header) => header === "roa",
  dividendYield: (header) => {
    if (header.includes("дд/чп")) return false;
    if (header.includes("дд ао")) return true;
    return header.includes("див") && header.includes("доход") && !header.includes("ап");
  },
  dividendYieldPref: (header) => header.includes("дд ап") || (header.includes("див") && header.includes("доход") && header.includes("ап")),
  debtLevel: (header) => header.includes("долг/ebitda"),
  evEbitda: (header) => header.includes("ev/ebitda")
};

function isHeaderCell(value) {
  const header = normalizeHeader(value);
  return Object.values(COLUMN_MATCHERS).some((matcher) => matcher(header));
}

function cellAt(cells, index) {
  if (!Array.isArray(cells) || index < 0) return "";
  return cells[index] ?? "";
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTicker(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function normalizeCompanyName(value) {
  return cleanText(value)
    .replace(/\s+ао$/i, "")
    .replace(/\s+ап$/i, "")
    .trim();
}

function parseNumberLikeText(value) {
  const text = cleanText(value);
  if (!text || /^[-—]+$/.test(text)) return null;

  let numberText = text
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/[^0-9.,+-]/g, "");

  if (!numberText || /^[-+.,]+$/.test(numberText)) return null;

  const lastComma = numberText.lastIndexOf(",");
  const lastDot = numberText.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    numberText = lastComma > lastDot
      ? numberText.replace(/\./g, "").replace(",", ".")
      : numberText.replace(/,/g, "");
  } else if (lastComma >= 0) {
    numberText = numberText.replace(",", ".");
  } else if ((numberText.match(/\./g) || []).length > 1) {
    const parts = numberText.split(".");
    const decimal = parts.pop();
    numberText = `${parts.join("")}.${decimal}`;
  }

  const parsed = Number(numberText);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value) {
  return parseNumberLikeText(value);
}

function parsePriceToNumber(value) {
  return parseNumberLikeText(value);
}

function isValidCompanyTicker(ticker) {
  return /^[A-Z0-9]{1,12}$/.test(normalizeTicker(ticker));
}

function isCompanyName(name, ticker) {
  const normalizedName = cleanText(name).toLowerCase();
  const normalizedTicker = normalizeTicker(ticker);
  if (!normalizedName || !normalizedTicker) return false;
  if (["IMOEX", "RTSI", "RGBI", "USDRUB", "CNYRUB"].includes(normalizedTicker)) return false;
  return !/(индекс|фьючерс|usd|eur|cny|биткоин|золото|серебро|платина|палладий|нефть)/i.test(normalizedName);
}

function firstMetric(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    return value;
  }
  return null;
}

function chooseMoreInformativeValue(baseValue, extraValue) {
  const base = cleanText(baseValue);
  const extra = cleanText(extraValue);
  if (!base) return extra;
  if (!extra) return base;

  const baseScore = informationScore(base);
  const extraScore = informationScore(extra);
  return extraScore > baseScore ? extra : base;
}

function informationScore(value) {
  const text = cleanText(value);
  return text.replace(/\s/g, "").length + (/[.,]\d/.test(text) ? 3 : 0);
}

function normalizePriceHistory(value) {
  const rawHistory = value?.instruments && typeof value.instruments === "object"
    ? value.instruments
    : value;
  const result = {};

  if (!rawHistory || typeof rawHistory !== "object" || Array.isArray(rawHistory)) {
    return result;
  }

  for (const [rawTicker, rawSeries] of Object.entries(rawHistory)) {
    const ticker = normalizeTicker(rawTicker);
    if (!ticker || !Array.isArray(rawSeries)) continue;

    result[ticker] = rawSeries
      .map((point) => {
        const price = parsePriceToNumber(point?.price ?? point?.close ?? point?.value);
        const date = cleanText(point?.date ?? point?.time ?? point?.label);
        if (!date || !Number.isFinite(price)) return null;
        return { date, price };
      })
      .filter(Boolean)
      .slice(-365);
  }

  return result;
}

function sortCompanies(a, b) {
  const sectorCompare = SECTOR_ORDER.indexOf(a.sectorSlug) - SECTOR_ORDER.indexOf(b.sectorSlug);
  if (sectorCompare !== 0) return sectorCompare;
  return a.ticker.localeCompare(b.ticker, "ru");
}

function logDiagnostics({ diagnostics, quotes, fundamentals, mergedCompanies, savedCompanies }) {
  console.log("[market-data] processed URLs:");
  for (const item of diagnostics) {
    console.log(`[market-data] ${item.key} ${item.role}: rows=${item.rows}; status=${item.status}; url=${item.url}`);
  }

  console.log(`[market-data] quotes companies=${quotes.length}`);
  console.log(`[market-data] fundamentals companies=${fundamentals.length}`);
  console.log(`[market-data] merged companies=${mergedCompanies.length}`);
  console.log(`[market-data] saved companies=${savedCompanies.length}`);
  console.log(`[market-data] first quotes tickers=${quotes.slice(0, 10).map((item) => item.ticker).join(", ")}`);
  console.log(`[market-data] first fundamentals tickers=${fundamentals.slice(0, 10).map((item) => item.ticker).join(", ")}`);
  console.log(`[market-data] first result tickers=${savedCompanies.slice(0, 10).map((item) => item.ticker).join(", ")}`);

  const sectorCounts = savedCompanies.reduce((acc, company) => {
    acc.set(company.sectorSlug, (acc.get(company.sectorSlug) || 0) + 1);
    return acc;
  }, new Map());

  for (const slug of SECTOR_ORDER) {
    console.log(`[market-data] sector ${slug}=${sectorCounts.get(slug) || 0}`);
  }

  const byTicker = new Map(savedCompanies.map((company) => [company.ticker, company]));
  for (const ticker of DIAGNOSTIC_TICKERS) {
    const company = byTicker.get(ticker);
    console.log(
      `[market-data] diagnostic ${ticker}: ${JSON.stringify({
        ticker,
        price: company?.price ?? null,
        changePercent: company?.changePercent ?? null,
        marketCap: company?.marketCap ?? null,
        pe: company?.pe ?? null,
        pb: company?.pb ?? null,
        roe: company?.roe ?? null,
        dividendYield: company?.dividendYield ?? null,
        debtLevel: company?.debtLevel ?? null,
        evEbitda: company?.evEbitda ?? null,
        score: company?.score ?? null
      })}`
    );
  }
}

main().catch((error) => {
  console.error(`[market-data] Unexpected error: ${error.stack || error.message}`);
  process.exitCode = 1;
});
