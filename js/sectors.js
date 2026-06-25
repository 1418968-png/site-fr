document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector("#sector-page")) return;
  initSectorPage();
});

async function initSectorPage() {
  const slug = new URLSearchParams(window.location.search).get("sector");
  const errorBox = document.querySelector("#sector-error");

  if (!slug) {
    showSectorError(errorBox, "Сектор не указан в URL.");
    return;
  }

  try {
    const [sectors, companies] = await Promise.all([
      fetchJson("data/sectors.json"),
      fetchJson("data/companies.json")
    ]);

    const sector = sectors.find((item) => item.slug === slug);
    if (!sector) {
      showSectorError(errorBox, "Сектор не найден.");
      return;
    }

    const sectorCompanies = companies.filter((company) => company.sectorSlug === slug);
    renderSector(sector, sectorCompanies);
  } catch {
    showSectorError(errorBox, "Не удалось загрузить данные сектора.");
  }
}

function renderSector(sector, companies) {
  document.title = `${sector.title} | Invest Navigator`;
  setText("#sector-title", sector.title);
  setText("#sector-description", sector.description);
  setText("#sector-risk", sector.riskLevel);
  setText("#sector-mood", sector.marketMood);

  const tbody = document.querySelector("#sector-companies-body");
  if (!tbody) return;

  if (companies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">В этом секторе пока нет компаний.</td></tr>';
    return;
  }

  tbody.innerHTML = companies
    .map((company) => {
      return `
        <tr>
          <td><a href="company.html?ticker=${encodeURIComponent(company.ticker)}">${escapeHtml(company.name)}</a></td>
          <td>${escapeHtml(company.ticker)}</td>
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

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }
  return response.json();
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
    tbody.innerHTML = '<tr><td colspan="8">Нет данных для отображения.</td></tr>';
  }
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
