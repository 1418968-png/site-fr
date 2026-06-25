document.addEventListener("DOMContentLoaded", () => {
  const grid = document.querySelector("#sector-grid");
  if (!grid) return;

  loadSectors()
    .then((sectors) => renderSectorCards(grid, sectors))
    .catch(() => {
      grid.innerHTML = '<p class="message error-message">Не удалось загрузить сегменты рынка.</p>';
    });
});

async function loadSectors() {
  const response = await fetch("data/sectors.json");
  if (!response.ok) {
    throw new Error("Sectors request failed");
  }
  return response.json();
}

function renderSectorCards(grid, sectors) {
  grid.innerHTML = sectors
    .map((sector, index) => {
      const number = String(index + 1).padStart(2, "0");
      return `
        <a class="sector-card" href="sector.html?sector=${encodeURIComponent(sector.slug)}">
          <span class="sector-card__index">${number}</span>
          <div>
            <h3>${escapeHtml(sector.title)}</h3>
            <p>${escapeHtml(sector.description)}</p>
          </div>
          <div class="card-meta">
            <span>Риск: ${escapeHtml(sector.riskLevel)}</span>
            <span>${escapeHtml(sector.marketMood)}</span>
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
