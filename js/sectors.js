document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector("#sector-page")) return;
  initSectorPage();
});

const sectorState = {
  companies: [],
  sector: null,
  allCompanyCount: 0
};

async function initSectorPage() {
  const slug = new URLSearchParams(window.location.search).get("sector");
  const errorBox = document.querySelector("#sector-error");

  if (!slug) {
    showSectorError(errorBox, "Сектор не указан в URL.");
    return;
  }

  try {
    const [sectors, companies] = await Promise.all([
      window.InvestNavigatorApi.getSectors(),
      window.InvestNavigatorApi.getCompanies()
    ]);

    const sector = sectors.find((item) => item.slug === slug);
    if (!sector) {
      showSectorError(errorBox, "Сектор не найден.");
      return;
    }

    const sectorCompanies = companies.filter((company) => company.sectorSlug === slug);
    console.log("[sector]", {
      sectorSlug: slug,
      totalCompanies: companies.length,
      filteredCompanies: sectorCompanies.length,
      tickers: sectorCompanies.map((company) => company.ticker)
    });
    sectorState.sector = sector;
    sectorState.companies = sectorCompanies;
    sectorState.allCompanyCount = companies.length;
    bindSectorControls();
    renderSector(sector);
    updateSectorTable();
  } catch {
    showSectorError(errorBox, "Не удалось загрузить данные сектора.");
  }
}

function bindSectorControls() {
  ["#sector-search", "#sector-sort"].forEach((selector) => {
    const element = document.querySelector(selector);
    if (!element) return;
    element.addEventListener("input", updateSectorTable);
    element.addEventListener("change", updateSectorTable);
  });

  const tbody = document.querySelector("#sector-companies-body");
  if (tbody && !tbody.dataset.boundRowNavigation) {
    tbody.dataset.boundRowNavigation = "true";
    tbody.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      const row = event.target.closest("tr[data-href]");
      if (row?.dataset.href) {
        window.location.href = row.dataset.href;
      }
    });
    tbody.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("tr[data-href]");
      if (!row?.dataset.href) return;
      event.preventDefault();
      window.location.href = row.dataset.href;
    });
  }
}

function renderSector(sector) {
  document.title = `${sector.title} | Invest Navigator`;
  setText("#sector-title", sector.title);
  setText("#sector-description", sector.description);
  setText("#sector-count", sectorState.companies.length);
}

function updateSectorTable() {
  const query = getValue("#sector-search").toLowerCase();
  const sortMode = getValue("#sector-sort") || "ticker-asc";
  const companies = sectorState.companies
    .filter((company) => {
      return (
        String(company.name || "").toLowerCase().includes(query) ||
        String(company.ticker || "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => sortCompanies(a, b, sortMode));

  setText("#sector-result-count", `${companies.length} найдено`);
  renderSectorRows(companies, Boolean(query));
}

function renderSectorRows(companies, isFiltered = false) {
  const tbody = document.querySelector("#sector-companies-body");
  if (!tbody) return;

  if (companies.length === 0) {
    const message = isFiltered
      ? "Компании не найдены."
      : sectorState.allCompanyCount === 0
        ? "Данные пока не загружены. Запустите обновление данных."
        : "В этом секторе пока нет загруженных компаний. Запустите обновление данных.";
    tbody.innerHTML = `<tr><td colspan="10">${escapeHtml(message)}</td></tr>`;
    return;
  }

  tbody.innerHTML = companies
    .map((company) => {
      const companyUrl = `company.html?ticker=${encodeURIComponent(company.ticker)}`;
      return `
        <tr class="clickable-row" tabindex="0" data-href="${companyUrl}">
          <td><a href="${companyUrl}">${escapeHtml(company.name)}</a></td>
          <td>${escapeHtml(company.ticker)}</td>
          <td>${formatValue(company.price)}</td>
          <td class="${changeClass(company.changePercent || company.change)}">${formatValue(company.changePercent || company.change)}</td>
          <td>${formatValue(company.pe)}</td>
          <td>${formatValue(company.pb)}</td>
          <td>${formatPercentLike(company.roe)}</td>
          <td>${formatPercentLike(company.dividendYield)}</td>
          <td>${formatValue(company.marketCap)}</td>
          <td><span class="score-badge ${scoreClass(company.score)}">${company.score}</span></td>
        </tr>
      `;
    })
    .join("");
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function showSectorError(errorBox, message) {
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
  const tbody = document.querySelector("#sector-companies-body");
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="10">Нет данных для отображения.</td></tr>';
  }
}

function getValue(selector) {
  return document.querySelector(selector)?.value.trim() || "";
}

function sortCompanies(a, b, mode) {
  if (mode === "price-desc") return compareNumbers(b.price, a.price);
  if (mode === "change-desc") return compareNumbers(b.changePercent || b.change, a.changePercent || a.change);
  if (mode === "pe-asc") return compareNumbers(a.pe, b.pe);
  if (mode === "roe-desc") return compareNumbers(b.roe, a.roe);
  if (mode === "score-desc") return Number(b.score || 0) - Number(a.score || 0);
  if (mode === "name-asc") return String(a.name || "").localeCompare(String(b.name || ""), "ru");
  return a.ticker.localeCompare(b.ticker, "ru");
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
