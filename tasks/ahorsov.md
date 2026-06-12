# Задачи для ahorsov

## Как отчитываться по работе

Прогресс, решения, ссылки на PR, проблемы и вопросы нужно писать в:

```text
tasks/ahorsov_report.md
```

Формат свободный, но желательно обновлять отчет после каждого заметного шага: что сделано, что проверено, что осталось, где есть блокеры.

## CI/CD автопроверка LAB_MODE

Нужно настроить автоматическую проверку lab-сценария в CI, чтобы каждый PR показывал, не сломался ли demo-loop.

CI должен поднимать backend stack, lab stack, запускать scan по lab targets через API и проверять, что ожидаемые demo findings реально появились.

## Что сделать

- Добавить GitHub Actions workflow.
- Запускать workflow на каждый pull request.
- В CI поднять:
  - backend;
  - worker;
  - postgres;
  - redis;
  - `lab/`.
- Включить:

```env
LAB_MODE=true
ENABLE_REAL_SCANNERS=false
ENABLE_NMAP=false
CELERY_TASK_ALWAYS_EAGER=false
```

- Дождаться готовности backend через healthcheck.
- Запустить scan по lab targets через API.
- Дождаться завершения каждого scan.
- Проверить, что ожидаемые findings найдены.
- Проверить, что report создан.
- Вывести краткий результат в GitHub Actions Summary.
- Сохранить JSON результатов как workflow artifact.

## Lab targets

Минимальный набор targets:

```text
admin.lab.local:8088
legacy.lab.local:8088
files.lab.local:8088
```

Если `juice.lab.local:8088` стабильно работает в CI, можно добавить отдельно, но он не должен блокировать базовый demo-loop на первом этапе.

## Expected findings

| Target | Expected finding |
| --- | --- |
| `admin.lab.local:8088` | `Exposed Admin Panel Demo` |
| `legacy.lab.local:8088` | `Legacy Service Demo` |
| `files.lab.local:8088` | `Directory Listing Demo` |

## Рекомендуемый workflow

Файл:

```text
.github/workflows/lab-mode.yml
```

Название:

```text
LAB_MODE Demo Loop
```

Triggers:

```yaml
on:
  pull_request:
  workflow_dispatch:
```

Важно оставить `workflow_dispatch`, чтобы можно было запускать проверку вручную.

## CI шаги

### 1. Checkout

```text
actions/checkout
```

### 2. Поднять backend dependencies

Поднять `postgres` и `redis` либо через `docker compose`, либо через GitHub Actions services.

Рекомендуется сначала использовать `docker compose`, чтобы CI был ближе к локальному запуску.

### 3. Поднять lab

Нужно поднять `lab/docker-compose.yml`.

Важно проверить network:

- backend container должен видеть lab targets;
- worker container должен видеть lab targets;
- `admin.lab.local:8088`, `legacy.lab.local:8088`, `files.lab.local:8088` должны резолвиться внутри контейнеров.

Если host-based routing через `*.lab.local` сложно поднять в CI, можно сделать CI-specific network aliases или отдельную env-настройку lab allowlist.

### 4. Поднять backend и worker с LAB_MODE

Нужно передать env:

```env
LAB_MODE=true
ALLOWED_LAB_TARGETS=admin.lab.local:8088,legacy.lab.local:8088,files.lab.local:8088
ENABLE_REAL_SCANNERS=false
ENABLE_NMAP=false
```

Название переменной `ALLOWED_LAB_TARGETS` нужно согласовать с backend-задачей `ikarpenko`.

### 5. Дождаться backend healthcheck

Проверять:

```bash
curl -fsS http://localhost:8000/health/ready
```

Нужен retry loop с timeout, например 60-120 секунд.

Если backend не стал ready, workflow должен упасть и вывести логи containers.

### 6. Запустить scans через API

Для каждого target:

```bash
curl -fsS -X POST http://localhost:8000/api/scans/start \
  -H "Content-Type: application/json" \
  -d '{"target":"admin.lab.local:8088","scan_profile":"lab","confirm_authorized":true}'
```

Из ответа нужно сохранить `id`.

### 7. Дождаться завершения scans

Polling:

```bash
curl -fsS http://localhost:8000/api/scans/<scan_id>
```

Ждать статусы:

```text
completed
failed
```

Если scan стал `failed`, workflow должен упасть.

Если scan не завершился за timeout, workflow должен упасть.

### 8. Проверить findings

Для каждого scan:

```bash
curl -fsS "http://localhost:8000/api/scans/<scan_id>/findings?limit=200&offset=0"
```

Проверить, что в `items[*].name` есть expected finding.

Если finding не найден, workflow падает.

### 9. Проверить report

Для каждого scan:

```bash
curl -fsS http://localhost:8000/api/scans/<scan_id>/report
```

Проверить:

- endpoint возвращает `200`;
- есть `summary`;
- есть `top_risks`;
- есть `recommendations`.

### 10. GitHub Actions Summary

Добавить таблицу в `$GITHUB_STEP_SUMMARY`:

```md
| Target | Expected finding | Status | Scan ID |
| --- | --- | --- | --- |
| admin.lab.local:8088 | Exposed Admin Panel Demo | passed | <uuid> |
| legacy.lab.local:8088 | Legacy Service Demo | passed | <uuid> |
| files.lab.local:8088 | Directory Listing Demo | passed | <uuid> |
```

Если target failed, status должен быть `failed`, а workflow должен завершиться ошибкой.

### 11. Artifact

Сохранить JSON результаты как artifact:

```text
artifacts/lab-mode-results.json
```

Внутри:

```json
{
  "mode": "LAB_MODE",
  "results": [
    {
      "target": "admin.lab.local:8088",
      "expected_finding": "Exposed Admin Panel Demo",
      "scan_id": "uuid",
      "scan_status": "completed",
      "finding_found": true,
      "report_created": true
    }
  ]
}
```

Использовать:

```text
actions/upload-artifact
```

## Ожидаемый результат

- При каждом PR CI автоматически проверяет `LAB_MODE`.
- Если expected finding не найден, workflow падает.
- Если backend не стартует, workflow падает.
- Если lab не стартует, workflow падает.
- Если scan завис в `created` или `running`, workflow падает по timeout.
- В GitHub Actions Summary видна таблица:
  - target;
  - expected finding;
  - status;
  - scan id.
- Есть artifact с JSON результатами scan.
- У команды появляется стабильная автоматическая проверка demo-сценария.

## Acceptance criteria

- Workflow запускается на `pull_request`.
- Workflow можно запустить вручную через `workflow_dispatch`.
- Backend readiness проверяется через `/health/ready`.
- В workflow есть timeout для startup и scan polling.
- При ошибке workflow выводит docker logs backend/worker/lab.
- `admin.lab.local:8088` проходит проверку на `Exposed Admin Panel Demo`.
- `legacy.lab.local:8088` проходит проверку на `Legacy Service Demo`.
- `files.lab.local:8088` проходит проверку на `Directory Listing Demo`.
- Для каждого target проверяется report.
- Summary создается всегда, даже если один target failed.
- Artifact создается всегда, если workflow дошел до scan step.

## Важные зависимости от backend-задачи

Эта CI-задача зависит от реализации backend-задач из:

```text
tasks/ikarpenko.md
```

Особенно важны:

- `LAB_MODE=true`;
- lab target allowlist;
- поддержка `host:port`;
- единый JSON API;
- корректный scan lifecycle;
- сохранение `Asset`, `Finding`, `RiskReport`.

До реализации backend `LAB_MODE` workflow можно подготовить как draft или сделать disabled/manual-only.

## Дополнительные требования к frontend

Frontend сейчас уже содержит основу dashboard:

- sidebar;
- header;
- форму запуска scan;
- блок scan status;
- metrics cards;
- статичные mock-данные в `frontend/src/types/dashboard.ts`;
- экран собирается через `App -> Dashboard -> Sidebar/Header/StartScan/MetricsGrid`.

Цель: довести интерфейс до рабочего demo-dashboard, похожего на референс, но подключенного к backend API.

Идеальный первый экран:

- слева фиксированная навигация:
  - Dashboard;
  - Scans;
  - Assets;
  - Reports;
- сверху компактный header:
  - SpectraScope;
  - Help;
  - user avatar/menu;
- основной dashboard без landing page;
- первый ряд:
  - `Start a New Scan`;
  - `Scan Status`;
- второй ряд:
  - `Assets`;
  - `Findings`;
  - `Top Risks`;
- третий ряд:
  - `AI Summary`;
  - `Recommended Actions`.

### Что нужно сделать по frontend

- Убрать зависимость dashboard от статичных mock-данных там, где backend уже отдает реальные данные.
- Подключить API:
  - `POST /api/scans/start`;
  - `GET /api/scans`;
  - `GET /api/scans/{scan_id}`;
  - `GET /api/scans/{scan_id}/assets`;
  - `GET /api/scans/{scan_id}/findings`;
  - `GET /api/scans/{scan_id}/report`.
- Сделать API client отдельным слоем, например:

```text
frontend/src/shared/api/
```

- Не размазывать `fetch` по компонентам.
- Все loading/error/empty states должны быть обработаны.
- UI должен работать с `application/json`.
- Даты отображать из ISO 8601 UTC в понятном локальном виде.
- UUID хранить как string.
- Ошибки backend показывать из единого формата:

```json
{
  "error": {
    "code": "TARGET_NOT_ALLOWED",
    "message": "Target is not allowed in LAB_MODE",
    "details": {}
  }
}
```

### Start a New Scan

Форма должна отправлять scan через backend:

```http
POST /api/scans/start
```

Payload:

```json
{
  "target": "admin.lab.local:8088",
  "scan_profile": "lab",
  "confirm_authorized": true
}
```

Требования:

- Поле `Domain` или `Target` принимает обычные targets и lab targets.
- В `LAB_MODE` удобно иметь быстрые варианты:
  - `admin.lab.local:8088`;
  - `legacy.lab.local:8088`;
  - `files.lab.local:8088`.
- Checkbox authorization обязателен.
- Кнопка `Start Scan` disabled, если target пустой или authorization не подтвержден.
- После успешного старта UI сохраняет `scan_id` и начинает polling статуса.
- Если backend вернул ошибку, показать понятный error message рядом с формой.

### Scan Status

Блок должен показывать текущий scan lifecycle:

```text
created -> running -> completed
created -> running -> failed
```

Требования:

- Polling `GET /api/scans/{scan_id}` до `completed` или `failed`.
- Для `created/running` показывать progress state.
- Для `completed` показывать зеленый success state.
- Для `failed` показывать error state и `error_message`.
- Steps:
  - Subdomains / Target;
  - Live Hosts;
  - Findings;
  - Report.
- Если backend пока не отдает детальный progress, steps можно вычислять по наличию:
  - scan status;
  - assets count;
  - findings count;
  - report.

### Assets

Блок должен использовать:

```http
GET /api/scans/{scan_id}/assets?limit=5&offset=0
```

Показывать:

- hostname;
- IP address;
- status;
- HTTP status;
- technologies, если есть.

Требования:

- `View all assets` открывает полный список или отдельное состояние таблицы.
- Список должен уважать backend sorting.
- Если assets нет, показывать empty state.

### Findings

Блок должен использовать:

```http
GET /api/scans/{scan_id}/findings?limit=5&offset=0
```

Показывать:

- finding name;
- asset или matched target;
- severity badge.

Severity colors:

```text
critical = red
high = red/orange
medium = amber
low = yellow/green
info = blue/gray
```

Для LAB_MODE ожидаемые findings:

- `Exposed Admin Panel Demo`;
- `Legacy Service Demo`;
- `Directory Listing Demo`.

### Top Risks

Блок должен использовать:

```http
GET /api/scans/{scan_id}/report
```

Показывать `top_risks`.

Минимальные колонки:

- risk;
- assets;
- severity.

Если backend возвращает другой shape, добавить frontend mapper, но не менять UI-компоненты под каждый backend вариант.

### AI Summary и Recommended Actions

Блок должен использовать report:

```http
GET /api/scans/{scan_id}/report
```

Показывать:

- `summary`;
- `recommendations`.

Важно: пока это не настоящий AI, в UI лучше назвать блок просто `Summary` или оставить `AI Summary`, если команда договорилась, что это product label.

### Состояния интерфейса

Нужно подготовить состояния:

- no scan selected;
- scan starting;
- scan running;
- scan completed;
- scan failed;
- backend unavailable;
- empty assets;
- empty findings;
- report not ready.

### Responsive требования

- Desktop: layout как на референсе, dense dashboard без marketing hero.
- Tablet: sidebar может стать верхней навигацией или компактной колонкой.
- Mobile: все блоки в одну колонку.
- Таблицы не должны ломать ширину viewport; использовать horizontal scroll или compact rows.

### Как добраться от текущего состояния к идеалу

1. Оставить текущий визуальный каркас dashboard.
2. Вынести mock data за feature flag или использовать только как fallback, если backend недоступен.
3. Добавить API client и типы response DTO.
4. Подключить `StartScan` к `POST /api/scans/start`.
5. Добавить polling текущего scan.
6. Подключить assets/findings/report blocks к backend.
7. Добавить loading/error/empty states.
8. Добавить lab target presets для demo.
9. Проверить CORS с `http://localhost:5173`.
10. После backend `LAB_MODE` проверить полный flow:

```text
Start scan -> polling -> assets -> findings -> report -> summary
```

### Frontend acceptance criteria

- Frontend запускается на `http://localhost:5173`.
- Dashboard открывается первым экраном.
- Можно запустить scan для `admin.lab.local:8088`.
- UI показывает running state.
- После завершения scan UI показывает найденный finding.
- Для `admin.lab.local:8088` виден `Exposed Admin Panel Demo`.
- Для `legacy.lab.local:8088` виден `Legacy Service Demo`.
- Для `files.lab.local:8088` виден `Directory Listing Demo`.
- Report summary и recommendations отображаются на dashboard.
- Ошибки backend отображаются человеку понятным текстом.
- Нет hardcoded `example.com` как единственного сценария.
- Mock data не маскирует реальные ошибки API.
- Интерфейс не ломается на пустых списках.
- Интерфейс не ломается на `failed` scan.

## Что не делать

- Не запускать real scanners в CI для LAB_MODE.
- Не сканировать внешние targets.
- Не делать CI зависимым от публичного интернета, кроме загрузки Docker images/actions.
- Не смешивать frontend build с LAB_MODE demo-loop в одном job, если это усложняет диагностику.
