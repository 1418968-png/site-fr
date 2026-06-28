document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector("#screener-page")) return;
  initScreener();
});

const screenerState = {
  companies: [],
  sectors: []
};

async function initScreener() {
  try {
    const companies = await window.InvestNavigatorApi.getCompanies();
    const sectors = buildSectorsFromCompanies(companies);

    screenerState.companies = companies;
    screenerState.sectors = sectors;
    populateSectorFilter(sectors);
    bindScreenerControls();
    updateScreener();
  } catch {
      const errorBox = document.querySelector("#screener-error");
    if (errorBox) {
      errorBox.textContent = "Не удалось загрузить данные скринера.";
      errorBox.hidden = false;
    }
    const tbody = document.querySelector("#screener-body");
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10">Нет данных для отображения.</td></tr>';
    }
  }
}

function populateSectorFilter(sectors) {
  const select = document.querySelector("#sector-filter");
  if (!select) return;

  select.insertAdjacentHTML(
    "beforeend",
    sectors
      .map((sector) => `<option value="${escapeHtml(sector.slug)}">${escapeHtml(sector.title)}</option>`)
      .join("")
  );
}

function bindScreenerControls() {
  [
    "#screener-search",
    "#sector-filter",
    "#sort-filter",
    "#change-filter",
    "#pe-max",
    "#roe-min"
  ].forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      element.addEventListener("input", updateScreener);
      element.addEventListener("change", updateScreener);
    }
  });
}

function updateScreener() {
  const query = getValue("#screener-search").toLowerCase();
  const sectorSlug = getValue("#sector-filter");
  const sortMode = getValue("#sort-filter") || "score-desc";
  const changeFilter = getValue("#change-filter");
  const peMax = parseMetric(getValue("#pe-max"));
  const roeMin = parseMetric(getValue("#roe-min"));

  const filtered = screenerState.companies
    .filter((company) => {
      const matchesQuery =
        company.name.toLowerCase().includes(query) ||
        company.ticker.toLowerCase().includes(query);
      const matchesSector = !sectorSlug || company.sectorSlug === sectorSlug;
      const change = parseMetric(company.changePercent || company.change);
      const matchesChange =
        !changeFilter ||
        (changeFilter === "positive" && Number.isFinite(change) && change > 0) ||
        (changeFilter === "negative" && Number.isFinite(change) && change < 0);
      const pe = parseMetric(company.pe);
      const roe = parseMetric(company.roe);
      const matchesPe = !Number.isFinite(peMax) || (Number.isFinite(pe) && pe <= peMax);
      const matchesRoe = !Number.isFinite(roeMin) || (Number.isFinite(roe) && roe >= roeMin);

      return matchesQuery && matchesSector && matchesChange && matchesPe && matchesRoe;
    })
    .sort((a, b) => sortCompanies(a, b, sortMode));

  renderScreenerRows(filtered);
}

function renderScreenerRows(companies) {
  const tbody = document.querySelector("#screener-body");
  const count = document.querySelector("#screener-count");

  if (count) {
    count.textContent = `${companies.length} найдено`;
  }

  if (!tbody) return;

  if (companies.length === 0) {
    const message = screenerState.companies.length === 0
      ? "Данные пока не загружены. Запустите обновление данных."
      : "Компании не найдены.";
    tbody.innerHTML = `<tr><td colspan="10">${escapeHtml(message)}</td></tr>`;
    return;
  }

  tbody.innerHTML = companies
    .map((company) => {
      return `
        <tr>
          <td><a href="company.html?ticker=${encodeURIComponent(company.ticker)}">${escapeHtml(company.name)}</a></td>
          <td>${escapeHtml(company.ticker)}</td>
          <td><a href="sector.html?sector=${encodeURIComponent(company.sectorSlug)}">${escapeHtml(company.sector)}</a></td>
          <td>${formatValue(company.price)}</td>
          <td class="${changeClass(company.changePercent || company.change)}">${formatValue(company.changePercent || company.change)}</td>
          <td>${formatValue(company.pe)}</td>
          <td>${formatValue(company.pb)}</td>
          <td>${formatPercentLike(company.roe)}</td>
          <td>${formatPercentLike(company.dividendYield)}</td>
          <td><span class="score-badge ${scoreClass(company.score)}">${company.score}</span></td>
        </tr>
      `;
    })
    .join("");
}

function sortCompanies(a, b, mode) {
  if (mode === "score-asc") return Number(a.score || 0) - Number(b.score || 0);
  if (mode === "pe-asc") return compareNumbers(a.pe, b.pe);
  if (mode === "roe-desc") return compareNumbers(b.roe, a.roe);
  if (mode === "change-desc") return compareNumbers(b.changePercent || b.change, a.changePercent || a.change);
  if (mode === "name-asc") return a.name.localeCompare(b.name, "ru");
  return Number(b.score || 0) - Number(a.score || 0);
}

function buildSectorsFromCompanies(companies) {
  const sectors = new Map();

  for (const company of companies) {
    if (!company.sectorSlug || !company.sector) continue;
    if (!sectors.has(company.sectorSlug)) {
      sectors.set(company.sectorSlug, {
        slug: company.sectorSlug,
        title: company.sector
      });
    }
  }

  return [...sectors.values()].sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

function getValue(selector) {
  return document.querySelector(selector)?.value.trim() || "";
}

function compareNumbers(left, right) {
  const a = parseMetric(left);
  const b = parseMetric(right);
  if (!Number.isFinite(a) && !Number.isFinite(b)) return 0;
  if (!Number.isFinite(a)) return 1;
  if (!Number.isFinite(b)) return -1;
  return a - b;
}

function parseMetric(value) {
  const text = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/%/g, "")
    .replace(/[^\d.+-]/g, "");
  return text ? Number(text) : NaN;
}

function formatValue(value) {
  const text = String(value ?? "").trim();
  return text || "Нет данных";
}

function formatPercentLike(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Нет данных";
  return text.includes("%") ? text : `${text}%`;
}

function changeClass(value) {
  const number = parseMetric(value);
  if (number > 0) return "positive";
  if (number < 0) return "negative";
  return "neutral";
}

function scoreClass(score) {
  if (score >= 75) return "score-high";
  if (score < 60) return "score-low";
  return "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
