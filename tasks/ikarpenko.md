# Задачи для ikarpenko

## Как отчитываться по работе

Прогресс, решения, ссылки на PR, проблемы и вопросы нужно писать в:

```text
tasks/ikarpenko_report.md
```

Формат свободный, но желательно обновлять отчет после каждого заметного шага: что сделано, что проверено, что осталось, где есть блокеры.

## LAB_MODE для локального demo-стенда

Нужно реализовать безопасный режим `LAB_MODE=true`, в котором SpectraScope умеет сканировать только локальные demo-сервисы из `lab/`.

### Что сделать

- Добавить настройку `LAB_MODE`.
- Разрешить в этом режиме только заранее известные lab targets.
- Поддержать allowlist именно в формате `host:port`, потому что текущий `normalize_target()` отбрасывает порт.
- Не смешивать `LAB_MODE` с обычной domain validation.
- Выполнять только безопасные HTTP `GET`-запросы.
- Не выполнять POST/PUT/PATCH/DELETE и любые state-changing запросы.
- Находить demo-маркеры:
  - `X-Spectra-Finding: exposed-admin-panel`
  - `X-Spectra-Finding: legacy-service`
  - `backup.zip`
  - `config.old`
- Сохранять найденное как `Asset`, `Finding`, `RiskReport`.
- Не ослаблять обычный режим, когда `LAB_MODE=false`.

### Рекомендуемая реализация

Сделать отдельный безопасный adapter:

```text
LabScannerAdapter
```

Он должен:

- принимать только allowlisted lab target;
- строить URL только из разрешенных `host:port`;
- выполнять только HTTP `GET`;
- читать headers и body;
- возвращать нормализованные результаты для pipeline;
- не использовать real scanner binaries;
- не использовать `shell=True`.

Пример allowlist:

```text
admin.lab.local:8088
legacy.lab.local:8088
files.lab.local:8088
juice.lab.local:8088
```

### Ожидаемый результат

- Scan `admin.lab.local:8088` находит `Exposed Admin Panel Demo`.
- Scan `legacy.lab.local:8088` находит `Legacy Service Demo`.
- Scan `files.lab.local:8088` находит `Directory Listing Demo`.
- Результаты видны через API.
- Неизвестные или внешние targets не разрешаются в `LAB_MODE`, если они не входят в lab allowlist.
- Обычный безопасный режим продолжает работать как раньше при `LAB_MODE=false`.

### Важное про Docker/network

Проверить, что backend и worker могут достучаться до lab-сервисов именно из контейнера.

`localhost` внутри backend container означает сам backend container, а не host machine. Поэтому нужно либо:

- подключить backend/worker и lab к совместимой Docker network;
- использовать service aliases;
- или явно задокументировать локальный режим запуска без Docker.

## API-контракт для frontend

### Общие требования

- Все ответы API должны быть `application/json`.
- Все даты должны быть в ISO 8601 UTC.
- Все `id` должны быть UUID string.
- Все endpoints должны быть доступны frontend с `http://localhost:5173` через CORS.
- Ошибки должны возвращаться в едином формате.
- Для списков `assets`, `findings`, `scans` нужна сортировка от новых к старым или явно задокументированная сортировка.
- Для больших списков нужен `limit` и `offset`.

### Единый формат ошибок

Сейчас ошибки возвращаются не одинаково: где-то `detail` строка, где-то объект.

Нужно привести к одному формату:

```json
{
  "error": {
    "code": "TARGET_NOT_ALLOWED",
    "message": "Target is not allowed in LAB_MODE",
    "details": {}
  }
}
```

Примеры кодов:

```text
TARGET_NOT_ALLOWED
TARGET_VALIDATION_FAILED
SCAN_ALREADY_RUNNING
SCAN_NOT_FOUND
REPORT_NOT_FOUND
INTERNAL_ERROR
```

### CORS

Добавить CORS middleware для frontend dev server:

```text
allow_origins=["http://localhost:5173"]
allow_methods=["GET", "POST", "OPTIONS"]
allow_headers=["*"]
```

### UTC даты

Сейчас модели используют `datetime.utcnow`, но это naive datetime без timezone.

Нужно:

- перейти на timezone-aware UTC;
- проверить JSON serialization;
- убедиться, что frontend получает даты в ISO 8601 UTC, например:

```json
"created_at": "2026-06-12T10:15:30Z"
```

или:

```json
"created_at": "2026-06-12T10:15:30+00:00"
```

### Сортировка списков

Сейчас:

- `scans` сортируются `created_at.desc()` — нормально;
- `audit` сортируется `created_at.desc()` — нормально;
- `assets` сортируются `Asset.created_at` по возрастанию;
- `findings` сортируются `Finding.created_at` по возрастанию.

Для frontend лучше сделать:

```text
created_at desc
```

для `scans`, `assets`, `findings`, `audit`.

Если порядок будет другим, его нужно явно задокументировать.

## Acceptance criteria

### LAB_MODE=false

- Обычный mock scan работает как раньше.
- `ENABLE_REAL_SCANNERS=false` по-прежнему не запускает external scanner binaries.
- Обычная target validation не ослаблена.
- Lab-only targets не получают специальных разрешений.

### LAB_MODE=true

- `admin.lab.local:8088` разрешен.
- `legacy.lab.local:8088` разрешен.
- `files.lab.local:8088` разрешен.
- `juice.lab.local:8088` разрешен, если входит в allowlist.
- `google.com` запрещен.
- `example.com` запрещен, если не входит в lab allowlist.
- `127.0.0.1:8088` запрещен, если явно не добавлен в отдельный безопасный local allowlist.
- Не выполняются POST/PUT/PATCH/DELETE.
- Найденные markers сохраняются как `Finding`.
- Для каждого успешного scan создаются `Asset` и `RiskReport`.
- При недоступном lab target scan переходит в `failed`, а не зависает в `running`.

### API

- `POST /api/scans/start` возвращает JSON.
- `GET /api/scans` возвращает `total`, `limit`, `offset`, `items`.
- `GET /api/scans/{scan_id}/assets` возвращает `total`, `limit`, `offset`, `items`.
- `GET /api/scans/{scan_id}/findings` возвращает `total`, `limit`, `offset`, `items`.
- `GET /api/scans/{scan_id}/report` возвращает JSON report.
- Ошибки `400`, `404`, `409`, `500` возвращаются в едином JSON-формате.
- CORS работает для `http://localhost:5173`.

## Тесты

Добавить backend tests на:

- target allowlist в `LAB_MODE`;
- запрет внешних targets в `LAB_MODE`;
- сохранение `Asset`, `Finding`, `RiskReport`;
- единый формат ошибок;
- сортировку списков от новых к старым;
- `limit` и `offset`;
- scan lifecycle:
  - `created -> running -> completed`;
  - `created -> running -> failed`.

## Связанные заметки

Команды и текущие scanner gaps описаны в:

```text
docs/scanner-commands.md
```
