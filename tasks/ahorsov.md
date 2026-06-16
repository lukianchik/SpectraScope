# Задачи для ahorsov

## Как отчитываться по работе

Прогресс, решения, ссылки на PR, проблемы и вопросы нужно писать в:

```text
tasks/ahorsov_report.md
```

Формат свободный, но желательно обновлять отчет после каждого заметного шага: что сделано, что проверено, что осталось, где есть блокеры.

## Контекст после merge в main

В `main` уже есть первый сквозной demo-flow:

- frontend запускается на Vite/Bun;
- dashboard подключен к backend API;
- `POST /api/scans/start` запускает scan;
- frontend делает polling scan status/assets/findings/report;
- backend поддерживает mock scanner mode и `LAB_MODE`;
- GitHub Actions содержит `LAB_MODE Demo Loop`;
- дефолтный `example.com` flow остается demo/mock и не является real recon.

Следующий этап: сделать dashboard полезным для просмотра результатов и честно показать пользователю, какой режим сейчас работает: demo/mock, lab или real scanners.

## Разделение ответственности

Реализация реальных scanner commands, Docker/runtime для `subfinder/httpx/nuclei`, scan profiles на backend и safe real scan execution вынесены в:

```text
tasks/ylukyanchik.md
```

Ahorsov не должен параллельно переписывать scanner runtime. Его задача - сделать frontend/product/CI слой, который будет использовать текущий backend API и позже подхватит real scan results из задачи `ylukyanchik`.

## Основной фокус

- Dashboard detail UI.
- Понятные состояния scan lifecycle.
- Разделение demo/mock, LAB_MODE и real scanners в интерфейсе.
- Frontend build/lint CI.
- Стабилизация LAB_MODE CI, если она падает.

## Задача 1. Scan detail UI

Сейчас dashboard показывает верхний summary, но пользователь не может нормально провалиться в данные scan.

После первых реальных `safe`-сканов стало видно, что backend уже возвращает настоящие `assets`, `findings` и `report`, но GUI пока показывает их слишком слабо: в основном только агрегаты и статус. Нужно сделать так, чтобы пользователь видел конкретные результаты скана, а не только цифры в карточках.

Нужно добавить рабочий scan detail experience на существующих backend endpoints:

```text
GET /api/scans
GET /api/scans/{scan_id}
GET /api/scans/{scan_id}/assets
GET /api/scans/{scan_id}/findings
GET /api/scans/{scan_id}/report
```

### Что сделать

- Добавить выбор scan из последних scans.
- Для выбранного scan показать:
  - status;
  - target;
  - scan profile;
  - timestamps;
  - error message, если scan failed.
- Добавить блок или вкладку `Assets` как полноценную таблицу результатов:
  - hostname;
  - IP;
  - alive/offline;
  - HTTP status;
  - title;
  - technologies.
- Добавить блок или вкладку `Findings` как полноценную таблицу результатов:
  - name;
  - severity;
  - source tool;
  - matched target;
  - description;
  - template id.
- Добавить блок `Report`:
  - summary;
  - top risks;
  - recommendations.
- Добавить нормальные empty states:
  - scan completed, но assets нет;
  - assets есть, findings нет;
  - report еще не создан;
  - scan failed.
- Для длинных списков предусмотреть скролл/табличный layout, чтобы dashboard не разваливался.
- Не скрывать реальные данные за общими метриками: минимум `Assets` и `Findings` должны быть видны на экране результатов или доступны через очевидные tabs.

### Acceptance criteria

- Можно выбрать старый scan из списка.
- После выбора scan dashboard обновляет assets/findings/report.
- Empty states выглядят нормально.
- Failed scan показывает понятную ошибку.
- UI не ломается на пустых списках.
- UI не показывает mock данные вместо ошибок API.
- После реального `safe` scan на `www.example.com` пользователь видит найденный asset с hostname, IP, HTTP status, title и technologies.
- Если nuclei ничего не нашел, UI честно показывает `0 findings`, а не выглядит как недогруженный экран.

## Задача 2. Развести demo/mock, LAB_MODE и real mode в UI

Пользователь должен понимать, какой режим он видит.

### Что сделать

- Добавить mode indicator:
  - `Demo data`;
  - `LAB_MODE`;
  - `Real scanners`.
- Для `example.com`/mock flow не писать, что это настоящий external recon.
- Когда backend вернет реальные scanner results, UI должен показывать их теми же assets/findings/report блоками без отдельной ручной ветки.
- Убрать или ослабить элементы, которые выглядят как несуществующие функции:
  - Slack/email notification channel, если backend не поддерживает;
  - статичные счетчики sidebar, если они не привязаны к API;
  - фейковый user card, если он выглядит как настоящая авторизация.

### Acceptance criteria

- Пользователь понимает, что demo/mock не равен real scan.
- Пользователь понимает, когда включен `LAB_MODE`.
- Пользователь понимает, когда данные пришли из real scanner mode.
- В UI нет ощущения, что Slack/email уже работают.

## Задача 3. Frontend build/lint CI

Сейчас есть lab CI, но frontend build лучше проверять отдельно, чтобы UI не ломался незаметно.

### Что сделать

- Добавить отдельный GitHub Actions job для frontend:
  - install Bun;
  - `bun install`;
  - `bun run build`;
  - по возможности `bun run lint`.
- Job должен запускаться на `pull_request`.
- Не смешивать frontend build и `LAB_MODE Demo Loop` в один большой шаг, чтобы проще читать failures.

### Acceptance criteria

- PR падает, если TypeScript/frontend build сломан.
- Frontend job не требует поднятого backend.
- Workflow logs ясно показывают, где ошибка: install/build/lint.

## Задача 4. Стабилизировать LAB_MODE CI после первых реальных прогонов

Если GitHub Actions `LAB_MODE Demo Loop` падает, нужно точечно исправить orchestration.

### Что проверить

- Docker network между backend/worker и lab.
- Startup timing backend/lab.
- `/health/ready`.
- Логи backend/worker/lab при failure.
- Artifact `artifacts/lab-mode-results.json`.
- GitHub Actions Summary.

### Acceptance criteria

- `LAB_MODE Demo Loop` стабильно проходит на PR.
- При падении workflow печатает достаточно логов для диагностики.
- Artifact создается при успешном scan loop.

## Задача 5. Подготовиться к real scan results от ylukyanchik

Когда backend начнет отдавать реальные results, frontend не должен требовать большой переделки.

### Что сделать

- Проверить frontend DTO и mappers в `frontend/src/shared/api/` и `frontend/src/types/dashboard.ts`.
- Убедиться, что UI не завязан на конкретные demo finding names.
- Убедиться, что severity, source_tool, template_id, raw_json absence/presence не ломают рендер.
- Добавить graceful fallback, если report еще не создан.

### Acceptance criteria

- Real scanner findings отображаются теми же компонентами, что LAB_MODE findings.
- Отсутствие report не ломает страницу.
- Большой список findings/assets не ломает layout.

## Что не делать в этой задаче

- Не реализовывать scanner command execution.
- Не добавлять Docker scanner runtime.
- Не менять backend scanner adapters без согласования.
- Не добавлять AI summary backend.
- Не включать `ENABLE_REAL_SCANNERS=true` по умолчанию.
- Не запускать scanners по чужим/external targets без allowlist.

## Ожидаемый результат этапа

После выполнения этих задач у проекта должен быть честный, понятный MVP dashboard:

- видно, что scan прошел через backend API;
- можно смотреть конкретные assets/findings/report;
- demo/mock режим не маскируется под real recon;
- frontend build проверяется в CI;
- lab demo-loop стабилен на PR;
- UI готов принять реальные scan results из backend-задачи `ylukyanchik`.
