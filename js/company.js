document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector("#company-page")) return;
  initCompanyPage();
});

async function initCompanyPage() {
  const ticker = new URLSearchParams(window.location.search).get("ticker");
  const errorBox = document.querySelector("#company-error");

  if (!ticker) {
    showCompanyError(errorBox, "Тикер не указан в URL.");
    return;
  }

  try {
    const companies = await fetchJson("data/companies.json");
    const company = companies.find((item) => item.ticker.toLowerCase() === ticker.toLowerCase());

    if (!company) {
      showCompanyError(errorBox, "Компания не найдена.");
      return;
    }

    renderCompany(company);
  } catch {
    showCompanyError(errorBox, "Не удалось загрузить данные компании.");
  }
}

function renderCompany(company) {
  document.title = `${company.name} | Invest Navigator`;

  const backLink = document.querySelector("#company-back-link");
  if (backLink) {
    backLink.href = `sector.html?sector=${encodeURIComponent(company.sectorSlug)}`;
  }

  setText("#company-name", company.name);
  setText("#company-meta", `${company.ticker} · ${company.sector}`);
  setText("#company-description", company.description);
  setText("#company-score", company.score);
  setText("#metric-pe", formatNumber(company.pe));
  setText("#metric-pb", formatNumber(company.pb));
  setText("#metric-roe", formatPercent(company.roe));
  setText("#metric-dividend", formatPercent(company.dividendYield));
  setText("#metric-debt", company.debtLevel);
  setText("#company-conclusion", company.conclusion);

  const scoreBar = document.querySelector("#company-score-bar");
  if (scoreBar) {
    scoreBar.style.width = `${Math.max(0, Math.min(100, company.score))}%`;
  }

  renderList("#company-strengths", company.strengths);
  renderList("#company-risks", company.risks);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }
  return response.json();
}

function renderList(selector, items) {
  const list = document.querySelector(selector);
  if (!list) return;

  list.innerHTML = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function showCompanyError(errorBox, message) {
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
  setText("#company-name", "Нет данных");
  setText("#company-meta", "");
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function formatNumber(value) {
  return Number(value).toFixed(1);
}

function formatPercent(value) {
  return `${Number(value).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
