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
    const [companies, sectors] = await Promise.all([
      fetchJson("data/companies.json"),
      fetchJson("data/sectors.json")
    ]);

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
      tbody.innerHTML = '<tr><td colspan="9">Нет данных для отображения.</td></tr>';
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
    "#pe-under-10",
    "#roe-over-15"
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
  const peUnder10 = document.querySelector("#pe-under-10")?.checked;
  const roeOver15 = document.querySelector("#roe-over-15")?.checked;

  const filtered = screenerState.companies
    .filter((company) => {
      const matchesQuery =
        company.name.toLowerCase().includes(query) ||
        company.ticker.toLowerCase().includes(query);
      const matchesSector = !sectorSlug || company.sectorSlug === sectorSlug;
      const matchesPe = !peUnder10 || Number(company.pe) < 10;
      const matchesRoe = !roeOver15 || Number(company.roe) > 15;

      return matchesQuery && matchesSector && matchesPe && matchesRoe;
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
    tbody.innerHTML = '<tr><td colspan="9">Компании не найдены.</td></tr>';
    return;
  }

  tbody.innerHTML = companies
    .map((company) => {
      return `
        <tr>
          <td><a href="company.html?ticker=${encodeURIComponent(company.ticker)}">${escapeHtml(company.name)}</a></td>
          <td>${escapeHtml(company.ticker)}</td>
          <td><a href="sector.html?sector=${encodeURIComponent(company.sectorSlug)}">${escapeHtml(company.sector)}</a></td>
          <td>${formatNumber(company.pe)}</td>
          <td>${formatNumber(company.pb)}</td>
          <td class="positive">${formatPercent(company.roe)}</td>
          <td>${formatPercent(company.dividendYield)}</td>
          <td>${escapeHtml(company.debtLevel)}</td>
          <td><span class="score-badge ${scoreClass(company.score)}">${company.score}</span></td>
        </tr>
      `;
    })
    .join("");
}

function sortCompanies(a, b, mode) {
  if (mode === "score-asc") return a.score - b.score;
  if (mode === "pe-asc") return a.pe - b.pe;
  if (mode === "roe-desc") return b.roe - a.roe;
  if (mode === "name-asc") return a.name.localeCompare(b.name, "ru");
  return b.score - a.score;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }
  return response.json();
}

function getValue(selector) {
  return document.querySelector(selector)?.value.trim() || "";
}

function formatNumber(value) {
  return Number(value).toFixed(1);
}

function formatPercent(value) {
  return `${Number(value).toFixed(1)}%`;
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
