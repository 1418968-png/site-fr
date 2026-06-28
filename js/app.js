document.addEventListener("DOMContentLoaded", () => {
  const grid = document.querySelector("#sector-grid");
  if (!grid) return;

  Promise.all([
    window.InvestNavigatorApi.getSectors(),
    window.InvestNavigatorApi.getCompanies()
  ])
    .then(([sectors, companies]) => {
      renderSnapshot(sectors, companies);
      renderSectorCards(grid, sectors, companies);
    })
    .catch(() => {
      grid.innerHTML = '<p class="message error-message">Не удалось загрузить сегменты рынка.</p>';
    });
});

function renderSnapshot(sectors, companies) {
  setText("#snapshot-sectors", sectors.length);
  setText("#snapshot-companies", companies.length);
}

function renderSectorCards(grid, sectors, companies) {
  const counts = companies.reduce((acc, company) => {
    acc.set(company.sectorSlug, (acc.get(company.sectorSlug) || 0) + 1);
    return acc;
  }, new Map());

  grid.innerHTML = sectors
    .map((sector, index) => {
      const number = String(index + 1).padStart(2, "0");
      const companyCount = counts.get(sector.slug) || 0;
      return `
        <a class="sector-card" href="sector.html?sector=${encodeURIComponent(sector.slug)}">
          <span class="sector-card__index">${number}</span>
          <div>
            <h3>${escapeHtml(sector.title)}</h3>
            <p>${escapeHtml(sector.description)}</p>
          </div>
          <div class="card-meta">
            <span>${companyCount} компаний</span>
          </div>
        </a>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}
