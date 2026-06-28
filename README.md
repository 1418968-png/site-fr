# Invest Navigator

Статический сайт для первичного анализа рыночных сегментов и компаний. Проект работает на HTML, CSS, Vanilla JavaScript и локальных JSON-файлах, без backend, iframe, внешних виджетов и переходов пользователя на сторонние страницы.

Информация на сайте носит аналитический и образовательный характер и не является индивидуальной инвестиционной рекомендацией.

## Как открыть сайт

Рекомендуемый локальный запуск на Windows:

```bash
start.bat
```

После запуска сайт доступен по адресу:

```text
http://127.0.0.1:5500/
```

Альтернативный запуск из корня проекта:

```bash
python -m http.server 5500 --bind 127.0.0.1
```

Страницы используют `fetch` для загрузки JSON, поэтому открытие HTML напрямую через `file://` может быть ограничено браузером. Проект совместим с GitHub Pages и любым статическим HTTP-сервером.

## npm-команды

```bash
npm install
npm run dev
npm run build
npm run update:market
```

- `npm run dev`, `npm start`, `npm run preview` запускают локальный статический сервер `scripts/dev-server.mjs`.
- `npm run build` выполняет быстрый статический чек проекта через `scripts/validate-static.mjs`.
- `npm run update:market` запускает `scripts/update-market-data.mjs` и обновляет локальные файлы данных.

## Рыночные данные

Frontend работает только с локальными файлами:

- `data/sectors.json` — список сегментов рынка.
- `data/companies.json` — компании и показатели для страниц сектора, компании и скринера.
- `data/market-data.json` — нормализованный рыночный снимок.
- `data/price-history.json` — накопительная история цен по тикерам для локального графика.

Обновление данных выполняется заранее скриптом `scripts/update-market-data.mjs`. Конфигурация разрешенных URL находится в `scripts/market-sources.config.mjs`. В пользовательском интерфейсе эти URL не отображаются, внешние ссылки в карточках компаний не используются.

Скрипт:

- загружает таблицу котировок, таблицу фундаментального анализа и включенные sector-pages из `scripts/market-sources.config.mjs`;
- разбирает HTML через `cheerio` и определяет колонки по заголовкам таблиц, без привязки к фиксированным индексам;
- объединяет котировки и фундаментальные показатели по тикеру;
- классифицирует только реально найденные тикеры через `SECTOR_MAP`;
- пересоздает `data/companies.json` только из реально извлеченных строк котировочной таблицы;
- сохраняет P/E, P/B, ROE, дивидендную доходность, капитализацию, долг/EBITDA и EV/EBITDA там, где они найдены;
- не перезаписывает старый `data/companies.json`, если новая выгрузка содержит меньше 50 компаний при наличии старого файла;
- пополняет `data/price-history.json` текущими ценами, не добавляя больше одной точки на тикер за день;
- не сохраняет внешние URL в JSON, используемые frontend;
- не использует авторизацию, API-ключи, CAPTCHA/antibot/rate-limit обходы.

## Страницы

- `index.html` — главная страница с сегментами рынка.
- `sector.html?sector=oilgas` — внутренняя страница сектора с поиском и сортировкой компаний.
- `company.html?ticker=LKOH` — внутренняя карточка компании с показателями, таблицей данных и локальным графиком.
- `screener.html` — общий скринер компаний с фильтрами по сектору, изменению, P/E и ROE.
- `methodology.html` — методология показателей и общий дисклеймер.

Все переходы по компаниям ведут только на `company.html?ticker=...`.

## Графики

На странице компании используется локальная сборка Chart.js:

```text
js/vendor/chart.umd.js
js/charts.js
```

Если в `data/price-history.json` есть одна точка, график уже строится, но рядом показывается сообщение о недостаточной истории. Если точек нет, показывается сообщение `История цены пока недоступна`.

## GitHub Actions

Workflow `.github/workflows/update-market-data.yml` запускается вручную и по расписанию раз в 3 часа. Он выполняет:

```bash
npm install
npm run update:market
```

Если изменились `data/market-data.json`, `data/companies.json`, `data/sectors.json` или `data/price-history.json`, workflow коммитит изменения с сообщением:

```text
Update market data
```

Если изменений нет, workflow завершается без ошибки.

## Структура

```text
investment-website/
├── index.html
├── sector.html
├── company.html
├── screener.html
├── methodology.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── api.js
│   ├── sectors.js
│   ├── company.js
│   ├── screener.js
│   ├── charts.js
│   ├── search.js
│   └── vendor/
│       └── chart.umd.js
├── data/
│   ├── sectors.json
│   ├── companies.json
│   ├── market-data.json
│   └── price-history.json
├── scripts/
│   ├── dev-server.mjs
│   ├── validate-static.mjs
│   ├── market-sources.config.mjs
│   └── update-market-data.mjs
├── .github/
│   └── workflows/
│       └── update-market-data.yml
├── package.json
└── README.md
```

## Демонстрационный exe

`dist/InvestNavigatorDemo.exe` является локальным артефактом и не отслеживается Git. После изменения HTML, CSS, JavaScript или JSON его нужно пересобрать на машине с .NET SDK 10:

```powershell
dotnet publish .\launcher\InvestNavigatorDemo\InvestNavigatorDemo.csproj -c Release -r win-x64 --self-contained true -o .\dist
```

В текущей среде .NET SDK может отсутствовать, поэтому актуальность `exe` нужно проверять отдельно.
