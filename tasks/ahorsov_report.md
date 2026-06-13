# Отчет ahorsov

Этот файл нужен, чтобы фиксировать прогресс по frontend и CI/CD задачам из `tasks/ahorsov.md`.

## Как заполнять

После каждого заметного шага добавляй новую запись в раздел `Журнал`.

В записи желательно указать:

- дату;
- что сделано;
- какие файлы или модули затронуты;
- как проверял;
- какие проблемы или блокеры остались;
- ссылку на PR или commit, если есть.

## Текущий статус

```text
in progress
```

## Журнал

### 2026-06-12

**Сделано:**

- Добавлен отдельный frontend API layer: `frontend/src/shared/api/client.ts` и `frontend/src/shared/api/scans.ts`.
- Подключен `QueryClientProvider` в `frontend/src/main.tsx`.
- `StartScan` переведен на `react-hook-form` + `zod`, добавлены lab presets, обработка validation/backend errors и реальный `POST /api/scans/start`.
- `Dashboard` переведен с mock-логики на реальные `GET /api/scans`, `GET /api/scans/{scan_id}`, `GET /assets`, `GET /findings`, `GET /report` с polling для активного scan.
- Статичные mock-массивы в `frontend/src/types/dashboard.ts` заменены на view-model helpers для metrics/status/steps.
- В backend включен CORS для `http://localhost:5173` и `http://127.0.0.1:5173` в `backend/app/main.py`.

**Проверено:**

- `bun run build` в `frontend` проходит успешно после интеграции.
- TypeScript типы для нового API-слоя, формы и dashboard проходят сборку.

**Осталось:**

- Подключить оставшиеся dashboard-блоки за пределами текущего экрана, если они будут добавлены в UI.
- Улучшить отображение backend errors до единого product-friendly формата после стабилизации backend contract.
- При необходимости вынести derived dashboard mappers из `types/dashboard.ts` в отдельный feature/module слой.

**Блокеры/вопросы:**

- Backend пока не отдает единый `error` envelope и явный `risk_score`, поэтому frontend временно нормализует ошибки сам и вычисляет risk score из findings.

**PR/commit:**

- Локальные изменения поверх ветки `ahorsov`, commit еще не создан.

### 2026-06-13

**Сделано:**

- Поднят backend локально через bundled Python 3.12 в `backend/.venv312` после проблем с системным Python 3.14 и wheel/build-зависимостями.
- Для локальной проверки API использован временный SQLite-файл в `%TEMP%`, потому что SQLite в workspace-каталоге падал с `disk I/O error` при создании journal-файлов.
- Проверен живой flow backend API для dashboard:
  - `GET /health`
  - `GET /health/ready`
  - `GET /api/scans`
  - `POST /api/scans/start`
  - `GET /api/scans/{scan_id}`
  - `GET /api/scans/{scan_id}/assets`
  - `GET /api/scans/{scan_id}/findings`
  - `GET /api/scans/{scan_id}/report`
- В `.gitignore` добавлены локальные backend-артефакты: `backend/.venv312/`, `backend/*.db`, `backend/*.db-*`.

**Проверено:**

- `/health` возвращает `{"status":"ok"}`.
- `/health/ready` возвращает `{"status":"ready","dependencies":{"postgres":"up","redis":"up"}}` в eager/local режиме.
- `POST /api/scans/start` возвращает JSON scan object, после polling scan переходит в `completed`.
- На тестовом target `lab.local` backend вернул:
  - `assets.total = 24`
  - `findings.total = 15`
  - готовый `report.summary`, `top_risks`, `recommendations`
- Это подтверждает, что текущий frontend contract с JSON response и polling работает на живом backend, а не только на mock data.

**Осталось:**

- Зафиксировать изменения коммитом в ветке `ahorsov`.
- Перейти к CI/CD задаче `LAB_MODE Demo Loop` из `tasks/ahorsov.md`.

**Блокеры/вопросы:**

- SQLite в каталоге проекта локально нестабилен в текущем окружении Codex/Windows, поэтому для ручной проверки использовался temp-path workaround.
- Для полноценной CI-задачи понадобится отдельно сверить backend `LAB_MODE` контракт и expected findings из backend-части.

### 2026-06-13 (LAB_MODE CI)

**Сделано:**

- Добавлен workflow `.github/workflows/lab-mode.yml` с `pull_request` и `workflow_dispatch`.
- Добавлен helper script `ops/lab_mode_ci.py`, который:
  - ждет `/health/ready`;
  - запускает scans по `admin.lab.local:8088`, `legacy.lab.local:8088`, `files.lab.local:8088`;
  - ждет финальный статус;
  - проверяет expected finding и наличие report;
  - пишет GitHub Actions Summary;
  - сохраняет `artifacts/lab-mode-results.json`.
- Для поддержки CI доработан backend:
  - `target_validation` теперь принимает `host:port`;
  - добавлены `LAB_MODE` и `ALLOWED_LAB_TARGETS` в config/env;
  - `target_policy` умеет ограничивать targets в `LAB_MODE`;
  - `scan_pipeline` умеет в `LAB_MODE` безопасно проверять demo targets через обычный HTTP GET без real scanners и создавать findings:
    - `Exposed Admin Panel Demo`
    - `Legacy Service Demo`
    - `Directory Listing Demo`
- Для docker-based CI обновлены compose/lab config:
  - env overrides в корневом `docker-compose.yml`;
  - network aliases `admin.lab.local`, `legacy.lab.local`, `files.lab.local`, `juice.lab.local` для lab reverse proxy;
  - nginx lab proxy теперь слушает `8088` и внутри docker network.
- Добавлены unit-тесты `tests/test_target_policy.py` и расширены `tests/test_target_validation.py`.

**Проверено:**

- `pytest tests/test_target_validation.py tests/test_target_policy.py` проходит: `10 passed`.
- Новый backend/CI Python-код синтаксически валиден через `compile(...)` без записи `.pyc`.

**Осталось:**

- Прогнать workflow end-to-end в GitHub Actions или локально в среде с доступным Docker.
- При необходимости подправить network/container orchestration по фактическим логам CI.
- После валидации собрать commit и push в ветку `ahorsov`.

**Блокеры/вопросы:**

- В текущем окружении Codex нет рабочего Docker, поэтому полный demo-loop через `lab/docker-compose.yml` не проверялся локально.
- Возможны точечные правки workflow по итогам первого реального прогона в GitHub Actions, особенно вокруг `docker network connect` и startup timing.

### 2026-06-13 (docs cleanup)

**Сделано:**

- Обновлен корневой `README.md` под текущую реализацию `LAB_MODE`, `host:port`, `ALLOWED_LAB_TARGETS` и новый workflow `LAB_MODE Demo Loop`.
- Обновлен `lab/README.md` с пояснением про docker network aliases в CI и про автоматический demo-loop.
- Обновлен `docs/scanner-commands.md`: убрана устаревшая заметка про потерю `:port` в `normalize_target()`, добавлены актуальные `LAB_MODE` notes.

**Проверено:**

- Текстовая документация согласована с текущими файлами `.github/workflows/lab-mode.yml`, `backend/app/services/target_validation.py`, `backend/app/services/target_policy.py`, `backend/app/services/scan_pipeline.py`.

**Осталось:**

- При первом реальном прогоне workflow в GitHub Actions уточнить README/CI notes только если фактический orchestration потребует правок.
