# Отчет ylukyanchik

Этот файл нужен, чтобы фиксировать прогресс по задачам из:

```text
tasks/ylukyanchik.md
```

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

### 2026-06-16 (final check before PR)

**Сделано:**

- Доведен первый рабочий real scanner path для `discovery` и `safe`.
- Scanner-enabled runtime вынесен в отдельные файлы:
  - `backend/Dockerfile.scanners`;
  - `docker-compose.real-scanners.yml`.
- В scanner image добавлены:
  - `subfinder`;
  - `httpx`;
  - `nuclei`;
  - `nuclei-templates`.
- `subfinder` ограничен timeout и `SCANNER_MAX_RESULTS`, чтобы ранние MVP-сканы не раздувались бесконтрольно.
- `httpx` переведен на batch mode через временный hosts file.
- `nuclei` переведен на batch mode через временный urls file.
- Для `nuclei` добавлен bounded safe starter pack templates вместо запуска всего публичного каталога.
- Добавлена настройка `NUCLEI_TEMPLATES_PATH`, чтобы позже можно было переопределять набор templates без переписывания кода.
- Исправлен parsing IP из `httpx`: теперь используется `host_ip` или первый адрес из `a`, а не hostname из поля `host`.
- На frontend добавлен progress bar для running scan, чтобы real scan не выглядел как зависший.
- Исправлена обработка backend timestamps на frontend: timestamps без timezone теперь трактуются как UTC.
- В задачи `ahorsov` добавлен frontend follow-up: нормальный вывод real scan results через `Assets`, `Findings`, `Report`.
- Устаревший корневой `TASK.md` удален, потому что актуальные задачи уже разнесены по `tasks/*.md`.

**Проверено:**

- `docker compose -f docker-compose.yml -f docker-compose.real-scanners.yml build backend worker` проходит успешно.
- Scanner-enabled контейнеры поднимаются через:
  - `docker compose -f docker-compose.yml -f docker-compose.real-scanners.yml up -d postgres redis backend worker`.
- `/health/ready` возвращает ready.
- В worker доступны scanner binaries:
  - `subfinder`;
  - `httpx`;
  - `nuclei`.
- Nuclei templates реально присутствуют в контейнере.
- Real `safe` scan на `www.example.com` завершился успешно:
  - status: `completed`;
  - найден 1 asset;
  - HTTP status: `200`;
  - title: `Example Domain`;
  - technologies: `Cloudflare`;
  - IP берется из `httpx`.
- Backend tests внутри Docker:
  - `tests/test_target_validation.py`;
  - `tests/test_target_policy.py`;
  - результат: `14 passed`.
- Frontend build:
  - `bun run build`;
  - результат: успешно.
- `git diff --check` проходит без whitespace errors.

**Осталось после этого PR:**

- Добавить backend/API способ отменять или чистить stale scans, чтобы старые `running` записи не блокировали target.
- Расширить frontend results UI: таблицы `Assets`, `Findings`, `Report`, выбор старых scans.
- Позже аккуратно расширять safe nuclei template pack на реальных разрешенных доменах.
- Не включать `nmap` по умолчанию до отдельной проверки UX/лимитов/безопасности.

**PR/commit:**

- Подготовлено к commit в ветке `ylukyanchik`.

### 2026-06-16

**Сделано:**

- Ветка `ylukyanchik` локально подведена к актуальному `main`.
- Добавлен первый real scanner MVP path:
  - `ScanStartRequest.scan_profile` ограничен профилями `discovery`, `safe`, `lab`;
  - real scanner mode требует непустой `ALLOWED_TARGET_DOMAINS`;
  - `discovery` запускает discovery/probing без `nuclei`;
  - `safe` запускает discovery/probing + `nuclei`;
  - `lab` требует `LAB_MODE=true` и не запускает external scanner binaries.
- Добавлен scanner-enabled Docker runtime:
  - `backend/Dockerfile.scanners`;
  - `docker-compose.real-scanners.yml`.
- Nuclei command дополнен исключением потенциально опасных tags:
  - `intrusive`;
  - `dos`;
  - `fuzz`.
- Frontend default scan profile изменен на `safe`, чтобы обычный `example.com` flow не отправлял `lab` profile.
- README и `docs/scanner-commands.md` обновлены под real scanner opt-in режим.
- Добавлены unit tests на real scanner allowlist gates.

**Проверено:**

- `bun run build` во frontend проходит успешно.
- `git diff --check` проходит без ошибок.

**Осталось:**

- Прогнать backend tests в окружении с установленным Python.
- Проверить Docker build scanner-enabled image.
- Проверить первый ручной real scan на домене из allowlist.
- При необходимости доработать parser/runtime поведение по фактическим логам `subfinder`, `httpx`, `nuclei`.

**Блокеры/вопросы:**

- В текущем Windows окружении `py -m pytest ...` не запускается: `No installed Python found!`.
- Docker daemon ранее был недоступен, поэтому scanner-enabled Docker build пока не проверен.

**PR/commit:**

- Локальные изменения в ветке `ylukyanchik`, commit пока не создан.
