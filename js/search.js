(function () {
  const state = {
    loaded: false,
    companies: [],
    sectors: []
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".global-search").forEach(setupGlobalSearch);
  });

  function setupGlobalSearch(input) {
    const shell = input.closest(".search-shell");
    if (!shell) return;

    const panel = document.createElement("div");
    panel.className = "search-results";
    panel.hidden = true;
    panel.setAttribute("role", "listbox");
    shell.appendChild(panel);

    input.addEventListener("input", () => updateResults(input, panel));
    input.addEventListener("focus", () => updateResults(input, panel));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        panel.hidden = true;
        input.blur();
      }
      if (event.key === "Enter") {
        const firstLink = panel.querySelector("a");
        if (firstLink) {
          window.location.href = firstLink.href;
        }
      }
    });

    document.addEventListener("click", (event) => {
      if (!shell.contains(event.target)) {
        panel.hidden = true;
      }
    });
  }

  async function updateResults(input, panel) {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      panel.hidden = true;
      return;
    }

    try {
      const { companies, sectors } = await getSearchData();
      const companyResults = companies
        .filter((company) => {
          return (
            company.name.toLowerCase().includes(query) ||
            company.ticker.toLowerCase().includes(query) ||
            company.sector.toLowerCase().includes(query)
          );
        })
        .slice(0, 6)
        .map((company) => ({
          title: `${company.name} (${company.ticker})`,
          meta: `${company.sector} · скоринг ${company.score}`,
          url: `company.html?ticker=${encodeURIComponent(company.ticker)}`
        }));

      const sectorResults = sectors
        .filter((sector) => {
          return (
            sector.title.toLowerCase().includes(query) ||
            sector.description.toLowerCase().includes(query)
          );
        })
        .slice(0, 3)
        .map((sector) => ({
          title: sector.title,
          meta: `${sector.riskLevel} риск · ${sector.marketMood}`,
          url: `sector.html?sector=${encodeURIComponent(sector.slug)}`
        }));

      const results = [...companyResults, ...sectorResults].slice(0, 8);
      renderSearchResults(panel, results);
    } catch {
      panel.innerHTML = '<div class="search-result"><strong>Поиск недоступен</strong><span>Не удалось загрузить данные.</span></div>';
      panel.hidden = false;
    }
  }

  async function getSearchData() {
    if (state.loaded) return state;

    const [companies, sectors] = await Promise.all([
      fetchJson("data/companies.json"),
      fetchJson("data/sectors.json")
    ]);

    state.companies = companies;
    state.sectors = sectors;
    state.loaded = true;
    return state;
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed: ${url}`);
    }
    return response.json();
  }

  function renderSearchResults(panel, results) {
    if (results.length === 0) {
      panel.innerHTML = '<div class="search-result"><strong>Ничего не найдено</strong><span>Измените запрос.</span></div>';
      panel.hidden = false;
      return;
    }

    panel.innerHTML = results
      .map((item) => {
        return `
          <a class="search-result" href="${item.url}" role="option">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.meta)}</span>
          </a>
        `;
      })
      .join("");
    panel.hidden = false;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
