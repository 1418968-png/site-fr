(function () {
  const cache = new Map();

  async function fetchJson(url) {
    if (cache.has(url)) return cache.get(url);

    const promise = fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`Не удалось загрузить ${url}`);
      }
      return response.json();
    });

    cache.set(url, promise);
    return promise;
  }

  function getCompanies() {
    return fetchJson("data/companies.json");
  }

  function getSectors() {
    return fetchJson("data/sectors.json");
  }

  function getMarketData() {
    return fetchJson("data/market-data.json");
  }

  function getPriceHistory() {
    return fetchJson("data/price-history.json");
  }

  window.InvestNavigatorApi = {
    fetchJson,
    getCompanies,
    getSectors,
    getMarketData,
    getPriceHistory
  };
})();
