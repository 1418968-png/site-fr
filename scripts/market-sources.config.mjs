export const MARKET_SOURCES = {
  mobile: {
    url: "https://smart-lab.ru/mobile/",
    enabled: true,
    role: "supplement"
  },

  shares: {
    url: "https://smart-lab.ru/q/shares/",
    enabled: true,
    role: "main_companies_list"
  },

  fundamentals: {
    url: "https://smart-lab.ru/q/shares_fundamental/",
    enabled: true,
    role: "fundamentals"
  },

  sectorPages: [
    {
      slug: "banks",
      title: "Банки",
      url: "https://smart-lab.ru/q/shares/?sector_id%5B%5D=2",
      enabled: true
    },
    {
      slug: "oilgas",
      title: "Нефть и газ",
      url: "https://smart-lab.ru/q/shares/?sector_id%5B%5D=1",
      enabled: true
    }
  ]
};
