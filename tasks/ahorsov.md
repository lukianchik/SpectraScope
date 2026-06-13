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

Следующий этап: начать переход от demo-flow к честному MVP с реальными инструментами, но сохранить безопасные default-настройки.

## Основной фокус

Ahorsov сейчас в активе, поэтому его фокус шире: frontend/product flow + первый real scanner spike.

Важно: real scanners нельзя включать по умолчанию и нельзя запускать по внешним targets без явного allowlist.

## Задача 1. First real scanner spike

Цель: сделать первый безопасный путь к реальному скану через существующие adapters, не ломая mock/LAB_MODE.

### Инструменты

Минимальный набор:

```text
subfinder
httpx
nuclei
```

`nmap` пока не включать в MVP real scan path, оставить отдельной optional темой.

### Что сделать

- Проверить текущие adapters:
  - `backend/app/scanners/subfinder.py`;
  - `backend/app/scanners/httpx.py`;
  - `backend/app/scanners/nuclei.py`.
- Подготовить Docker/runtime способ, чтобы tools были доступны внутри backend/worker container.
- Сохранить безопасные defaults:

```env
ENABLE_REAL_SCANNERS=false
ENABLE_NMAP=false
```

- Real scanners должны запускаться только если:
  - `ENABLE_REAL_SCANNERS=true`;
  - `LAB_MODE=false`;
  - `ALLOWED_TARGET_DOMAINS` непустой;
  - target входит в allowlist.
- Проверить один локальный allowlisted domain flow.
- Обновить README/docs с честной инструкцией запуска real scan mode.

### Acceptance criteria

- `docker compose up --build` без env остается demo/mock, без real scanner binaries execution.
- При `ENABLE_REAL_SCANNERS=true` и allowlist backend пытается использовать реальные tools.
- Если scanner binary отсутствует, scan fail не ломает backend process и пишет понятный error.
- Direct IP targets по-прежнему запрещены.
- Unknown/non-allowlisted domain запрещен.
- В docs ясно написано, что real scan можно запускать только на своих/разрешенных domains.

## Задача 2. Scan profiles сделать настоящими

Сейчас `scan_profile` есть в API/UI, но profile почти не влияет на pipeline.

### Профили

```text
discovery
safe
lab
```

### Что сделать

- `lab`: только `LAB_MODE` path, без real scanner binaries.
- `discovery`: `subfinder` + `httpx`, без `nuclei`.
- `safe`: `subfinder` + `httpx` + безопасный набор `nuclei` templates.
- Unknown profile отклонять понятной ошибкой.
- UI select должен отправлять только поддержанные значения.

### Acceptance criteria

- `lab` profile не запускает real scanners.
- `discovery` не запускает `nuclei`.
- `safe` запускает `nuclei` только при `ENABLE_REAL_SCANNERS=true`.
- Unknown profile не приводит к молчаливому fallback.

## Задача 3. Scanner output visibility for debugging

Нужно, чтобы первые real runs можно было отлаживать без гадания.

### Что сделать

- Логировать scanner stage:
  - discovery;
  - probing;
  - nuclei;
  - reporting.
- Логировать tool missing/timeout/parser errors безопасно, без огромных raw dumps в stdout.
- Для failed scan сохранять понятный `error_message`.
- В report или raw_json findings сохранять минимальный evidence, который нужен frontend/AI-summary в будущем.

### Acceptance criteria

- Если scanner не установлен, понятно какой именно tool отсутствует.
- Если scanner timeout, понятно на какой stage.
- Failed scan виден в UI как failed, а не зависает в running.

## Задача 4. Scan detail UI

Параллельно с real scanner spike нужно сделать dashboard полезнее для просмотра результатов.

### Что сделать

- Добавить выбор scan из последних scans.
- Для выбранного scan показать:
  - status;
  - target;
  - scan profile;
  - timestamps;
  - error message, если scan failed.
- Добавить блок или вкладку `Assets`:
  - hostname;
  - IP;
  - alive/offline;
  - HTTP status;
  - title;
  - technologies.
- Добавить блок или вкладку `Findings`:
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

### Acceptance criteria

- Можно выбрать старый scan из списка.
- После выбора scan dashboard обновляет assets/findings/report.
- Empty states выглядят нормально.
- Failed scan показывает понятную ошибку.
- UI не показывает mock данные вместо ошибок API.

## Задача 5. Развести demo/mock и real mode в UI

Пользователь должен понимать, какой режим он видит.

### Что сделать

- Добавить mode indicator:
  - `Demo data`;
  - `LAB_MODE`;
  - `Real scanners`.
- Для `example.com`/mock flow не писать, что это настоящий external recon.
- Убрать или ослабить элементы, которые выглядят как несуществующие функции:
  - Slack/email notification channel, если backend не поддерживает;
  - статичные счетчики sidebar, если они не привязаны к API.

### Acceptance criteria

- Пользователь понимает, что demo/mock не равен real scan.
- Пользователь понимает, когда включен real scanner mode.
- В UI нет ощущения, что Slack/email уже работают.

## Задача 6. Frontend build/lint CI

### Что сделать

- Добавить отдельный GitHub Actions job:
  - install Bun;
  - `bun install`;
  - `bun run build`;
  - по возможности `bun run lint`.
- Job должен запускаться на `pull_request`.

### Acceptance criteria

- PR падает, если TypeScript/frontend build сломан.
- Frontend job не требует поднятого backend.
- Workflow logs ясно показывают, где ошибка: install/build/lint.

## Что не делать в этой задаче

- Не добавлять AI summary backend.
- Не делать attack-path reasoning.
- Не включать `ENABLE_REAL_SCANNERS=true` по умолчанию.
- Не запускать scanners по чужим/external targets без allowlist.
- Не включать `nmap` в default real scan MVP.

## Ожидаемый результат этапа

После выполнения этих задач проект должен перейти от demo skeleton к первому честному MVP-path:

```text
allowlisted domain
-> discovery/safe profile
-> real subfinder/httpx/nuclei where enabled
-> normalized assets/findings/report
-> dashboard detail view
```

Mock и LAB_MODE при этом должны остаться стабильными и безопасными.
