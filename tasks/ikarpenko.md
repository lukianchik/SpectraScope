# Задачи для ikarpenko

## Как отчитываться по работе

Прогресс, решения, ссылки на PR, проблемы и вопросы нужно писать в:

```text
tasks/ikarpenko_report.md
```

Формат свободный, но желательно обновлять отчет после каждого заметного шага: что сделано, что проверено, что осталось, где есть блокеры.

## Контекст после merge в main

Ahorsov сейчас берет активную работу по real scanner spike и dashboard detail. Чтобы не конфликтовать с ним, ikarpenko получает отдельный backend/product-intelligence блок, который можно начать позже.

Цель блока: подготовить слой нормализации, приоритизации и будущего AI summary, не меняя scanner runtime, который будет крутить ahorsov.

## Основной фокус

Работать в backend data/contract/risk слое, документации и тестах.

Не трогать:

- frontend layout;
- scanner Docker/runtime;
- adapters `subfinder/httpx/nuclei`, если это пересекается с PR ahorsov;
- GitHub Actions frontend/lab jobs.

## Задача 1. Risk scoring contract

Нужно уйти от простого подсчета severity к первому контекстному risk score.

### Что сделать

- Описать backend-функцию или service для расчета risk score.
- Минимальные факторы:
  - finding severity;
  - asset is alive;
  - service looks sensitive: `admin`, `auth`, `login`, `vpn`, `sso`, `backup`, `staging`;
  - finding source;
  - number of findings per asset.
- Score должен быть объяснимым: почему asset/finding получил такой приоритет.
- Не менять scanner adapters.

### Acceptance criteria

- Есть unit tests на scoring.
- Score стабилен и детерминирован.
- В коде есть понятный mapper/reason list, который потом можно показать в UI/AI summary.

## Задача 2. AI summary input contract

Перед подключением нейросети нужно подготовить структурированный input, чтобы AI не выдумывал факты.

### Что сделать

- Спроектировать JSON payload для будущего AI summary.
- Payload должен включать только evidence из БД:
  - scan target;
  - assets;
  - services/technologies;
  - findings;
  - top risks;
  - recommendations;
  - risk reasons.
- Добавить функцию, которая строит этот payload из scan data.
- Пока не вызывать OpenAI/API и не добавлять ключи.

### Acceptance criteria

- Есть unit test на shape payload.
- Payload не содержит огромных raw dumps.
- Каждое утверждение в payload связано с asset/finding/evidence.
- Код можно будет позже использовать для реального AI summary.

## Задача 3. Report model improvements

Текущий `RiskReport` уже есть, но для MVP-приоритизации нужно сделать его ближе к defensive summary.

### Что сделать

- Подготовить структуру `top_risks`, чтобы она была стабильной:
  - title/risk;
  - severity;
  - affected assets;
  - reason;
  - recommended action.
- Сохранить backward compatibility с текущим frontend.
- Добавить tests на build report для:
  - empty findings;
  - low/info findings only;
  - high finding на sensitive asset;
  - LAB_MODE finding.

### Acceptance criteria

- Report summary объясняет, что защищать первым.
- `top_risks` не является произвольным набором dict без ожидаемых ключей.
- Existing frontend не ломается.

## Задача 4. API error envelope

Frontend сейчас умеет читать разные форматы ошибок, но backend лучше привести к единому contract.

### Формат

```json
{
  "error": {
    "code": "TARGET_NOT_ALLOWED",
    "message": "Target is not allowed in LAB_MODE",
    "details": {}
  }
}
```

### Что сделать

- Ввести единый helper/exception handler для API errors.
- Покрыть минимум:
  - target validation failed;
  - target not allowed;
  - active scan already running;
  - scan not found;
  - report not found.
- Не менять successful response DTO.

### Acceptance criteria

- `400`, `404`, `409` возвращают единый JSON envelope.
- Frontend продолжает работать без изменений.
- Добавлены backend tests на error shape.

## Задача 5. Parser fixtures без runtime-конфликта

Если ahorsov уже меняет adapters, не трогать их. Но можно подготовить fixtures и тестовый контракт.

### Что сделать

- Добавить fixtures для ожидаемых outputs:
  - subfinder;
  - httpx JSON;
  - nuclei JSONL.
- Добавить документацию expected normalized shape.
- Если adapters в этот момент активно меняются у ahorsov, оставить fixtures/docs без правок runtime-кода.

### Acceptance criteria

- Fixtures лежат в понятном месте, например:

```text
tests/fixtures/scanners/
```

- Их можно использовать позже для parser tests.
- Нет конфликтов с текущим scanner runtime PR.

## Что не делать в этой задаче

- Не включать real scanners.
- Не менять Dockerfile под scanner tools.
- Не менять frontend UI.
- Не подключать реальную нейросеть/API.
- Не запускать внешние scans.

## Ожидаемый результат этапа

После задач ikarpenko у проекта появится фундамент для Palantir-like ценности:

```text
raw findings
-> normalized scan context
-> contextual risk score
-> evidence-based AI summary input
-> defensive priorities
```

Это отдельный слой поверх real scanner work ahorsov, поэтому ikarpenko сможет подключиться через несколько дней без болезненных конфликтов.
