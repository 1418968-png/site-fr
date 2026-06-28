document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector("#company-page")) return;
  initCompanyPage();
});

async function initCompanyPage() {
  const ticker = new URLSearchParams(window.location.search).get("ticker")?.toUpperCase();
  const errorBox = document.querySelector("#company-error");

  if (!ticker) {
    showCompanyError(errorBox, "Тикер не указан в URL.");
    return;
  }

  try {
    const [companies, priceHistory] = await Promise.all([
      window.InvestNavigatorApi.getCompanies(),
      window.InvestNavigatorApi.getPriceHistory().catch(() => ({}))
    ]);
    const company = companies.find((item) => item.ticker.toLowerCase() === ticker.toLowerCase());

    if (!company) {
      showCompanyError(errorBox, "Компания не найдена.");
      return;
    }

    renderCompany(company, priceHistory);
  } catch {
    showCompanyError(errorBox, "Не удалось загрузить данные компании.");
  }
}

function renderCompany(company, priceHistory) {
  document.title = `${company.name} | Invest Navigator`;

  const backLink = document.querySelector("#company-back-link");
  if (backLink) {
    backLink.href = `sector.html?sector=${encodeURIComponent(company.sectorSlug)}`;
  }

  setText("#company-name", company.name);
  setText("#company-meta", `${company.ticker} · ${company.sector}`);
  setText("#company-description", formatValue(company.description));
  setText("#company-score", company.score);
  setText("#company-price", formatValue(company.price));
  setText("#company-change", formatValue(company.changePercent || company.change));
  setText("#company-market-cap", formatValue(company.marketCap));
  setText("#metric-price", formatValue(company.price));
  setText("#metric-change", formatValue(company.changePercent || company.change));
  setText("#metric-pe", formatValue(company.pe));
  setText("#metric-pb", formatValue(company.pb));
  setText("#metric-roe", formatPercentLike(company.roe));
  setText("#metric-dividend", formatPercentLike(company.dividendYield));
  setText("#metric-market-cap", formatValue(company.marketCap));
  setText("#metric-volume", formatValue(company.volume));
  setText("#metric-debt", formatValue(company.debtLevel));
  setText("#metric-ev-ebitda", formatValue(company.evEbitda));
  setText("#company-conclusion", formatValue(company.conclusion));
  setChangeClass("#company-change", company.changePercent || company.change);
  setChangeClass("#metric-change", company.changePercent || company.change);

  const scoreBar = document.querySelector("#company-score-bar");
  if (scoreBar) {
    scoreBar.style.width = `${Math.max(0, Math.min(100, company.score))}%`;
  }

  renderList("#company-strengths", company.strengths);
  renderList("#company-risks", company.risks);
  renderMarketTable(company);
  renderPriceChart(company, priceHistory);
}

function renderList(selector, items) {
  const list = document.querySelector(selector);
  if (!list) return;

  const safeItems = Array.isArray(items) && items.length > 0 ? items : ["Нет данных"];
  list.innerHTML = safeItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function renderMarketTable(company) {
  const tbody = document.querySelector("#company-market-table");
  if (!tbody) return;

  const rows = [
    ["Название", company.name],
    ["Тикер", company.ticker],
    ["Сектор", company.sector],
    ["Цена", company.price],
    ["Изменение", company.changePercent || company.change],
    ["P/E", company.pe],
    ["P/B", company.pb],
    ["ROE", formatPercentLike(company.roe)],
    ["ROA", formatPercentLike(company.roa)],
    ["Дивидендная доходность", formatPercentLike(company.dividendYield)],
    ["Дивидендная доходность прив.", formatPercentLike(company.dividendYieldPref)],
    ["Капитализация", company.marketCap],
    ["Объем", company.volume],
    ["Долг/EBITDA", company.debtLevel],
    ["EV/EBITDA", company.evEbitda],
    ["Аналитическая оценка", company.score]
  ];

  tbody.innerHTML = rows
    .map(([label, value]) => {
      const valueClass = label === "Изменение" ? ` class="${changeClass(value)}"` : "";
      return `<tr><td>${escapeHtml(label)}</td><td${valueClass}>${escapeHtml(formatValue(value))}</td></tr>`;
    })
    .join("");
}

function renderPriceChart(company, priceHistory) {
  const series = Array.isArray(priceHistory?.[company.ticker])
    ? priceHistory[company.ticker]
    : priceHistory?.instruments?.[company.ticker] || [];

  if (window.InvestNavigatorCharts?.renderPriceChart) {
    window.InvestNavigatorCharts.renderPriceChart({
      canvasSelector: "#price-chart",
      emptySelector: "#price-chart-empty",
      series,
      label: company.ticker
    });
  }
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

function setChangeClass(selector, value) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.classList.remove("positive", "negative", "neutral");
  element.classList.add(changeClass(value));
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

function parseMetric(value) {
  const text = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/%/g, "")
    .replace(/[^\d.+-]/g, "");
  return text ? Number(text) : NaN;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
