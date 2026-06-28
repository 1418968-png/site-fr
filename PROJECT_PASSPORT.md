# PROJECT_PASSPORT.md

## Жесткое правило сопровождения

`PROJECT_PASSPORT.md` всегда должен поддерживаться в актуальном состоянии.

Любой разработчик или ИИ-агент, выполняющий изменения в проекте, обязан в рамках той же задачи обновить этот файл так, чтобы он отражал полную техническую информацию, необходимую следующему разработчику для работы.

Перед завершением любой задачи необходимо проверить, что в `PROJECT_PASSPORT.md` зафиксированы:

- созданные, измененные и удаленные файлы;
- изменения архитектуры, структуры проекта и пользовательских сценариев;
- добавленные, удаленные или обновленные зависимости;
- команды запуска, сборки, проверки, тестирования и деплоя;
- переменные окружения, конфигурации и внешние интеграции;
- важные технические решения и причины их принятия;
- известные ограничения, риски, TODO и незавершенные работы;
- результаты выполненных проверок.

Задача не считается полностью завершенной, если `PROJECT_PASSPORT.md` устарел или не отражает произведенные изменения.

## Текущее состояние проекта

- Корневая директория проекта: `C:\Codex\Site-FR`.
- Проект: статический сайт Invest Navigator для первичного анализа рыночных сегментов, компаний и базовых рыночных показателей.
- Стек: HTML5, CSS3, Vanilla JavaScript, JSON, Node.js/npm, `cheerio`, локальная сборка Chart.js, GitHub Actions.
- Backend, React, Next.js, iframe, внешние виджеты и пользовательские переходы на внешний источник данных не используются.
- Frontend читает только локальные JSON-файлы через относительные пути и остается совместимым с GitHub Pages.
- Данные обновляются заранее через `scripts/update-market-data.mjs`; разрешенные технические URL вынесены в `scripts/market-sources.config.mjs`.
- Пользовательские страницы не показывают название внешнего источника, поле `Источник`, кнопки открытия оригинала или внешние ссылки на инструменты.
- `dist\InvestNavigatorDemo.exe` остается локальным артефактом, игнорируется Git и требует пересборки после изменений сайта на машине с .NET SDK 10.

## Команды

Установка и локальный preview:

```powershell
npm install
npm run dev
```

Проверка проекта:

```powershell
npm run build
```

Обновление рыночных данных:

```powershell
npm run update:market
```

Локальный запуск без npm:

```powershell
.\start.bat
```

или:

```powershell
python -m http.server 5500 --bind 127.0.0.1
```

Пересборка демонстрационного `exe`:

```powershell
dotnet publish .\launcher\InvestNavigatorDemo\InvestNavigatorDemo.csproj -c Release -r win-x64 --self-contained true -o .\dist
```

В текущей среде .NET SDK может отсутствовать, поэтому `dist\InvestNavigatorDemo.exe` после изменений сайта не считается автоматически актуальным.

## Архитектура

- `index.html` показывает 12 сегментов рынка из `data/sectors.json` и считает количество компаний по фактическому `data/companies.json`.
- `sector.html?sector=...` показывает внутреннюю страницу сектора, количество компаний, поиск внутри сектора и сортировку по тикеру, названию, цене, изменению, P/E, ROE и аналитической оценке.
- `company.html?ticker=...` показывает название, тикер, сектор, цену, изменение, капитализацию, объем, P/E, P/B, ROE, дивидендную доходность, долг/EBITDA, EV/EBITDA, таблицу рыночных данных, аналитическую оценку, риски, вывод и локальный график; пустые поля отображаются как `Нет данных`.
- `screener.html` показывает все компании из `data/companies.json`, строит фильтр секторов по этим же данным, фильтрует по сектору, названию/тикеру, положительному/отрицательному изменению, P/E и ROE, сортирует по аналитической оценке и другим полям.
- `methodology.html` описывает показатели и содержит общий инвестиционный дисклеймер.
- Все клики по компаниям ведут только на `company.html?ticker=...`; `target="_blank"` для компаний не используется.
- `js/api.js` содержит общие функции загрузки `data/companies.json`, `data/sectors.json`, `data/market-data.json`, `data/price-history.json`.
- `js/charts.js` рисует график через локальный `js/vendor/chart.umd.js`; если истории нет, показывает `История цены пока недоступна.`, а при одной точке показывает график и сообщение о недостаточной истории.
- `scripts/validate-static.mjs` проверяет обязательные файлы, отсутствие старых Smart-Lab-файлов, валидность JSON, JS-синтаксис, форму `data/sectors.json`, `data/market-data.json` и плоского `data/price-history.json`, отсутствие запрещенных URL-полей в данных, отсутствие абсолютных `/data/...` fetch-путей, `target="_blank"`, включенного PWA/Service Worker и старых публичных формулировок/iframe/TradingView во frontend.

## Данные

- `data/sectors.json`: 12 сегментов в фиксированном порядке: `banks`, `oilgas`, `metals`, `tech`, `energy`, `consumer`, `realestate`, `telecom`, `finance`, `transport`, `chemistry`, `other`.
- `data/companies.json`: 259 компаний после текущего обновления; список пересоздается только из реально извлеченных строк котировочной таблицы и не сохраняет старые вымышленные карточки.
- `data/market-data.json`: нормализованный снимок с полями `updatedAt`, `instruments`, `indices`, `currencies`, `futures`, `bonds`, `funds`; legacy-поле `markets` удалено.
- `data/price-history.json`: плоский объект `TICKER -> массив точек { date, price }`; текущий снимок содержит 251 тикер с одной точкой истории, история ограничивается 365 точками на тикер и не добавляет дубликат за тот же день.
- В JSON, используемые frontend, не записываются внешние URL.
- Если обновление не удалось, скрипт сохраняет старые JSON без удаления.
- Если новая выгрузка содержит меньше 50 компаний и старый `data/companies.json` существует, старый файл компаний не перезаписывается.

## Рыночный updater

- `scripts/market-sources.config.mjs` содержит объект `MARKET_SOURCES` с ролями `mobile`, `shares`, `fundamentals` и массивом `sectorPages`; текущие включенные URL: общая таблица котировок, таблица фундаментального анализа, mobile supplement, страницы банков и нефтегаза.
- `scripts/update-market-data.mjs` загружает таблицу котировок и таблицу фундаментального анализа, дополнительно обрабатывает включенные sectorPages, разбирает HTML через `cheerio`, определяет колонки по заголовкам таблиц и объединяет котировки с фундаментальными показателями по `ticker`.
- В скрипте есть `SECTOR_MAP` для автоматической классификации только реально извлеченных тикеров по секторам; неизвестные тикеры попадают в `other` — `Прочие компании`.
- При успешном обновлении `data/companies.json` не сливается со старым списком компаний: старые тикеры, которых нет в текущей выгрузке, удаляются, чтобы не возвращались моковые и вымышленные карточки.
- Недоступные фундаментальные показатели записываются как `null` или пустая строка; скрипт не подставляет тестовые P/E, P/B, ROE, дивиденды, капитализацию, долг/EBITDA, EV/EBITDA, описания, сильные стороны, риски или выводы.
- Скоринг рассчитывается осторожно по простой формуле 0-100 на основе только доступных полей: положительное изменение, P/E, P/B, ROE, дивидендная доходность, капитализация и долг/EBITDA. В интерфейсе это называется `Аналитическая оценка`, не рекомендация купить.
- Updater печатает диагностику обработанных URL, количества строк и компаний, первые тикеры, распределение по секторам и контрольные показатели для ключевых тикеров.
- Скрипт не использует API-ключи, авторизацию, обход CAPTCHA, antibot, rate limits или агрессивные запросы.
- Архитектура позволяет позже добавить дополнительные разрешенные URL в `MARKET_SOURCES`.

## GitHub Actions

- `.github/workflows/update-market-data.yml` запускается вручную и по cron `0 */3 * * *`.
- Workflow выполняет `npm install` и `npm run update:market`.
- Если изменились `data/market-data.json`, `data/companies.json`, `data/sectors.json` или `data/price-history.json`, workflow коммитит их с сообщением `Update market data`.
- Если изменений нет, workflow завершается без ошибки.

## Структура проекта

```text
C:\Codex\Site-FR
├── .codexignore
├── .gitignore
├── .npmrc
├── package.json
├── package-lock.json
├── README.md
├── PROJECT_PASSPORT.md
├── start.bat
├── company.html
├── index.html
├── methodology.html
├── screener.html
├── sector.html
├── .github
│   └── workflows
│       └── update-market-data.yml
├── css
│   └── style.css
├── data
│   ├── companies.json
│   ├── market-data.json
│   ├── price-history.json
│   └── sectors.json
├── js
│   ├── api.js
│   ├── app.js
│   ├── charts.js
│   ├── company.js
│   ├── screener.js
│   ├── search.js
│   ├── sectors.js
│   └── vendor
│       └── chart.umd.js
├── scripts
│   ├── dev-server.mjs
│   ├── market-sources.config.mjs
│   ├── update-market-data.mjs
│   └── validate-static.mjs
└── launcher
    └── InvestNavigatorDemo
        ├── InvestNavigatorDemo.csproj
        └── Program.cs
```

## Изменения 2026-06-27

- Удалены `smartlab.html`, `js/smartlab.js`, `data/smartlab-mobile.json`, `scripts/update-smartlab-mobile.mjs`, `.github/workflows/update-smartlab-mobile.yml`.
- Удален пользовательский пункт меню внешней страницы со всех HTML-страниц.
- Созданы `scripts/market-sources.config.mjs` и `scripts/update-market-data.mjs`.
- Созданы `data/market-data.json` и `data/price-history.json`.
- Обновлены `data/companies.json` и `data/sectors.json` новой нормализованной схемой.
- Создан `js/charts.js`; добавлен локальный `js/vendor/chart.umd.js`.
- Обновлены `index.html`, `sector.html`, `company.html`, `screener.html`, `methodology.html`.
- Обновлены `js/api.js`, `js/app.js`, `js/sectors.js`, `js/company.js`, `js/screener.js`, `js/search.js`.
- Полностью заменен `css/style.css`: удалены стили старой отдельной внешней страницы, добавлены стили таблиц, фильтров, карточки компании, графика и адаптивности.
- Обновлен `package.json`: добавлена команда `update:market`, удалена команда старого updater, добавлена зависимость `chart.js`.
- Обновлен `package-lock.json` через `npm install`.
- Создан `.github/workflows/update-market-data.yml`.
- Обновлен `README.md`.
- Обновлен `scripts/validate-static.mjs`.
- Дополнительно исправлен `scripts/update-market-data.mjs`: удалено сохранение старых компаний, не найденных в текущей выгрузке; словарь `SECTOR_MAP` приведен к 12 целевым секторам; `data/market-data.json` больше не получает legacy-поле `markets` и внутренние URL.
- Дополнительно обновлены `data/companies.json`, `data/sectors.json`, `data/market-data.json`, `data/price-history.json`: текущий снимок содержит 16 реально извлеченных компаний и 12 секторов, старые вымышленные карточки удалены.
- Дополнительно обновлены `js/app.js`, `js/sectors.js`, `js/company.js`, `js/screener.js`, `js/search.js`: счетчики строятся из `companies.json`, сектор получил сортировку по названию и кликабельные строки, скринер больше не загружает `sectors.json`, поиск не ожидает `riskLevel/marketMood`, пустой вывод компании показывает честную заглушку.
- Дополнительно обновлен `sector.html`: удален блок риска, добавлена сортировка по названию.
- Дополнительно обновлен `css/style.css`: добавлены стили для кликабельных строк таблицы.
- Дополнительно усилен `scripts/validate-static.mjs`: проверяет отсутствие старых Smart-Lab-файлов, точный набор секторных slug, отсутствие `markets` в `market-data.json` и отсутствие запрещенных URL-полей в данных.
- В рамках исправления интеграции рыночных данных полностью переписаны `scripts/market-sources.config.mjs` и `scripts/update-market-data.mjs`: добавлены роли `shares`, `fundamentals`, `mobile`, `sectorPages`; котировки и фундаментальные таблицы парсятся отдельно по заголовкам и объединяются по `ticker`; добавлена защита `MIN_COMPANIES_FOR_FULL_UPDATE = 50`.
- Обновлены `data/companies.json`, `data/market-data.json`, `data/sectors.json`, `data/price-history.json`: текущий снимок содержит 259 компаний из котировочной таблицы, фундаментальные показатели из таблицы анализа и плоскую накопительную историю цен по тикерам.
- Обновлены `company.html`, `js/company.js`, `js/charts.js`, `js/sectors.js`, `js/screener.js`, `css/style.css`: страница компании показывает EV/EBITDA и долг/EBITDA, пустые отдельные поля отображаются как `Нет данных`, график строится даже по одной локальной точке истории с сообщением о недостаточной истории, секторная страница пишет dev-диагностику только в консоль.
- Обновлены `README.md` и `scripts/validate-static.mjs`: документация описывает новую схему updater, валидатор проверяет плоский `price-history.json`, отсутствие `target="_blank"`, старой пользовательской формулировки пустых данных и абсолютных `/data/...` fetch-путей во frontend.

## Результаты проверок 2026-06-27

- `npm install` завершился успешно, зависимости актуальны.
- `npm run update:market` завершился успешно: `quotes companies=259`, `fundamentals companies=233`, `merged companies=259`, `saved companies=259`.
- Диагностика updater подтвердила распределение: `banks=9`, `oilgas=9`, `metals=10`, `tech=10`, `energy=14`, `consumer=10`, `realestate=4`, `telecom=3`, `finance=3`, `transport=4`, `chemistry=9`, `other=174`.
- Контрольные тикеры получили объединенные данные там, где они есть в таблицах: `SBER` содержит цену, изменение, капитализацию, P/E, P/B, ROE, дивидендную доходность и score; `ALRS` содержит цену, изменение, капитализацию, P/E, P/B, дивидендную доходность, долг/EBITDA, EV/EBITDA и score.
- `data/price-history.json` содержит плоскую историю по 251 тикеру с текущей ценовой точкой; повторный запуск в тот же день обновляет точку за день без добавления дубля.
- `npm run build` успешно выполнил `scripts/validate-static.mjs`.
- Быстрый поиск по frontend-файлам не нашел пользовательских внешних переходов, `TradingView`, `iframe`, `target="_blank"`, моковых массивов, старой пользовательской формулировки пустых данных или абсолютных `/data/...` fetch-путей.
- Через локальный сервер на `127.0.0.1:5521` получены HTTP 200 для `/`, `/sector.html?sector=banks`, `/sector.html?sector=oilgas`, `/sector.html?sector=metals`, `/company.html?ticker=SBER`, `/company.html?ticker=ALRS`, `/screener.html`; `/smartlab.html` вернул HTTP 404.
- Через headless Microsoft Edge подтверждено, что `sector.html?sector=banks` показывает `Сбербанк`, `VTBR` и `9 найдено`; `sector.html?sector=oilgas` показывает `ГАЗПРОМ`, `ЛУКОЙЛ` и `9 найдено`; `sector.html?sector=metals` показывает `АЛРОСА`, `НЛМК` и `10 найдено`; `company.html?ticker=SBER` показывает P/E, P/B `0.81`, ROE `22.7%` и сообщение о недостаточной истории; `company.html?ticker=ALRS` показывает P/E `4.2`, P/B `0.4`, EV/EBITDA `4.1` и сообщение о недостаточной истории; `screener.html` показывает `259 найдено`.

## Ограничения и TODO

- Текущая котировочная таблица дает 259 компаний, но большая часть неизвестных для `SECTOR_MAP` тикеров попадает в `other`; для более точной классификации нужно расширять словарь только для реально найденных тикеров.
- Некоторые контрольные тикеры могут отсутствовать в итоговом `companies.json`, если они есть в фундаментальной таблице, но отсутствуют в текущей котировочной таблице; updater не создает компании только из fundamentals или словаря.
- История цен начала накапливаться с текущего запуска; для большинства тикеров пока есть одна точка, поэтому frontend показывает сообщение о недостаточной истории для полноценного графика.
- Не все фундаментальные показатели доступны для всех типов компаний; отсутствующие значения остаются `null` или пустой строкой и показываются в интерфейсе как `Нет данных`.
- `dist\InvestNavigatorDemo.exe` не пересобран в рамках этой задачи; для актуальной embedded-версии нужен .NET SDK 10 и команда `dotnet publish`.
