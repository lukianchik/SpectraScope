# Задачи для ylukyanchik

## Как отчитываться по работе

Прогресс, решения, ссылки на PR, проблемы и вопросы нужно писать в:

```text
tasks/ylukyanchik_report.md
```

Формат свободный, но желательно обновлять отчет после каждого заметного шага: что сделано, что проверено, что осталось, где есть блокеры.

## Контекст

В `main` уже есть demo-flow:

- mock scanner mode по умолчанию;
- `LAB_MODE` для локального lab;
- backend API для scans/assets/findings/report;
- frontend dashboard, который ходит в backend;
- lab CI.

Теперь нужно взять часть прежней задачи ahorsov и начать честный real scan path: реальные команды, реальные scanner tools, безопасный запуск только по allowlisted domains.

## Главная цель

Сделать первый безопасный real scanner MVP path:

```text
allowlisted domain
-> subfinder
-> httpx
-> nuclei safe templates
-> normalized assets/findings
-> existing report/dashboard endpoints
```

При этом default project mode должен остаться безопасным:

```env
ENABLE_REAL_SCANNERS=false
ENABLE_NMAP=false
```

## Задача 1. Проверить и довести scanner adapters

### Файлы

```text
backend/app/scanners/subfinder.py
backend/app/scanners/httpx.py
backend/app/scanners/nuclei.py
backend/app/scanners/base.py
backend/app/services/scan_pipeline.py
```

### Что сделать

- Проверить, какие команды реально вызывают adapters.
- Убедиться, что нигде не используется `shell=True`.
- Проверить timeout behavior.
- Проверить поведение, если binary отсутствует.
- Проверить parsing stdout/stderr.
- Сделать ошибки понятными для `scan.error_message`.

### Acceptance criteria

- Missing binary приводит к failed scan с понятным сообщением.
- Timeout приводит к failed scan с понятным сообщением.
- Backend process не падает целиком из-за scanner error.
- Mock mode продолжает работать при `ENABLE_REAL_SCANNERS=false`.

## Задача 2. Docker/runtime для scanner tools

Нужно, чтобы backend/worker container мог запускать реальные tools.

### Инструменты

Минимальный набор:

```text
subfinder
httpx
nuclei
```

`nmap` пока не включать в default real scan MVP.

### Что сделать

- Решить, где устанавливаются scanner binaries:
  - в `backend/Dockerfile`;
  - или в отдельном scanner-enabled image/stage.
- Зафиксировать версии или хотя бы install method.
- Проверить, что worker видит эти binaries.
- Документировать команды проверки:

```bash
subfinder -version
httpx -version
nuclei -version
```

### Acceptance criteria

- `docker compose up --build` без real env не запускает real scanners.
- При real env worker может найти scanner binaries.
- Runtime setup описан в README/docs.

## Задача 3. Safety gates для real scan

Real scan должен быть невозможен случайно.

### Условия запуска real scanners

Real scanners могут запускаться только если:

```text
ENABLE_REAL_SCANNERS=true
LAB_MODE=false
ALLOWED_TARGET_DOMAINS is not empty
target matches ALLOWED_TARGET_DOMAINS
```

### Что сделать

- Проверить текущую target policy.
- Добавить отдельную проверку, что при `ENABLE_REAL_SCANNERS=true` allowlist не пустой.
- Убедиться, что direct IP targets запрещены по умолчанию.
- Убедиться, что subdomains allowlisted domains разрешены.
- Добавить unit tests на real scan gates.

### Acceptance criteria

- `ENABLE_REAL_SCANNERS=true` + пустой `ALLOWED_TARGET_DOMAINS` запрещает scan.
- `google.com` запрещен, если не в allowlist.
- `sub.example.com` разрешен, если `example.com` в allowlist.
- IP targets запрещены.
- LAB_MODE gates не ломаются.

## Задача 4. Scan profiles на backend

Сейчас `scan_profile` есть в API/UI, но backend почти не различает profiles.

### Профили

```text
discovery
safe
lab
```

### Поведение

- `discovery`: `subfinder` + `httpx`, без `nuclei`.
- `safe`: `subfinder` + `httpx` + safe `nuclei` templates.
- `lab`: только `LAB_MODE` path, без real scanner binaries.

### Что сделать

- Добавить validation неизвестного `scan_profile`.
- Развести pipeline stages по profile.
- Не ломать текущие response models.
- Добавить tests.

### Acceptance criteria

- Unknown profile возвращает понятную ошибку.
- `discovery` не запускает `nuclei`.
- `safe` запускает `nuclei` только при включенных real scanners.
- `lab` не запускает external tools.

## Задача 5. Первый ручной real scan flow

Нужно получить первый настоящий результат на allowlisted domain, который принадлежит тебе или явно разрешен.

### Что сделать

- Создать local env для real scan:

```env
ENABLE_REAL_SCANNERS=true
ENABLE_NMAP=false
ALLOWED_TARGET_DOMAINS=<your-authorized-domain>
```

- Запустить backend/worker.
- Запустить scan через API:

```bash
curl -X POST http://localhost:8000/api/scans/start \
  -H "Content-Type: application/json" \
  -d '{"target":"<your-authorized-domain>","scan_profile":"discovery","confirm_authorized":true}'
```

- Проверить:
  - scan status;
  - assets;
  - findings, если `safe`;
  - report;
  - logs.

### Acceptance criteria

- Есть задокументированный manual run.
- Scan не зависает в `running`.
- Результаты видны через existing API.
- Если scanner ничего не нашел, это корректно отображается как empty state, а не failure.

## Задача 6. Documentation

Нужно честно описать разницу между modes.

### Что обновить

```text
README.md
docs/scanner-commands.md
.env.example
.env.local.example
```

### Что написать

- Demo/mock mode не делает external recon.
- LAB_MODE ходит только по local lab targets.
- Real scanner mode opt-in.
- Real scanner mode требует allowlist.
- Какие tools нужны.
- Как проверить tools.
- Как запустить discovery/safe scan.
- Какие ограничения у MVP.

### Acceptance criteria

- Новый человек понимает, как безопасно запустить real scan.
- В docs нет обещания, что real mode включен по умолчанию.
- В docs явно написано: сканировать можно только свои или разрешенные assets.

## Что не делать

- Не включать `ENABLE_REAL_SCANNERS=true` по умолчанию.
- Не включать `nmap` в default real scan MVP.
- Не добавлять aggressive nuclei templates.
- Не сканировать чужие domains.
- Не переписывать frontend dashboard.
- Не добавлять AI summary.

## Ожидаемый результат

После выполнения этой задачи у SpectraScope должен появиться первый честный real scan path:

```text
authorized domain
-> real discovery
-> real probing
-> optional safe findings
-> stored assets/findings/report
-> frontend can display results
```

Это ключевой шаг от demo skeleton к настоящему MVP.
