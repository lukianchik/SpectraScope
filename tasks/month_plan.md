# План работы на месяц

Период: конец июня - июль 2026.

Контекст: `ylukyanchik` как руководитель проекта будет недоступен примерно месяц. На этот период задачи распределяются между `ahorsov` и `ikarpenko`. Цель - двигаться автономно, маленькими PR, без расползания scope.

## Главная цель месяца

Довести SpectraScope до понятного MVP-кандидата:

```text
authorized domain
-> safe scan
-> assets
-> findings / honest empty state
-> defensive report
-> понятный dashboard
```

Проект остается defensive/authorized-only:

- не сканировать чужие цели без разрешения;
- real scanners только через allowlist;
- не включать aggressive templates;
- не включать `nmap` по умолчанию;
- не включать `ENABLE_REAL_SCANNERS=true` по умолчанию.

## Как работать без руководителя

- Каждый ведет свой report сам:
  - `tasks/ahorsov_report.md`;
  - `tasks/ikarpenko_report.md`.
- Не писать report за другого человека.
- Делать маленькие PR, которые можно проверить.
- В каждом PR писать:
  - что сделано;
  - как проверить;
  - какие ограничения остались.
- Если задача меняет API contract, явно написать это в PR.
- Если есть сомнение, выбирать то, что приближает MVP demo, а не расширяет продукт вширь.

## Задачи для ahorsov

Фокус: frontend/product experience.

Ahorsov в активе, поэтому его задачи основные и самые близкие к пользовательскому MVP.

### 1. Scan Results UI

Сейчас backend уже умеет отдавать реальные `assets`, `findings`, `report`, но GUI показывает результаты слишком агрегированно.

Нужно сделать нормальный экран результатов scan.

Что сделать:

- добавить выбор scan из последних scans;
- для выбранного scan показывать:
  - target;
  - status;
  - scan profile;
  - timestamps;
  - error message, если scan failed;
- добавить блок или вкладку `Assets`:
  - hostname;
  - IP;
  - alive/offline;
  - HTTP status;
  - title;
  - technologies;
- добавить блок или вкладку `Findings`:
  - severity;
  - name;
  - source tool;
  - template id;
  - matched target;
  - description;
- добавить блок `Report`:
  - summary;
  - top risks;
  - recommendations.

Acceptance:

- после real `safe` scan на `www.example.com` пользователь видит найденный asset;
- если findings нет, UI честно показывает `0 findings`, а не выглядит сломанным;
- failed scan показывает понятную ошибку;
- пустые списки не ломают layout.

### 2. Scan Lifecycle UX

Довести ощущение запуска scan до нормального состояния.

Что сделать:

- progress/status не должен выглядеть как зависание;
- completed scan должен подтягивать финальные assets/findings/report;
- active scan conflict должен быть понятен пользователю;
- добавить нормальные loading/empty/error states;
- проверить поведение после refresh страницы.

Acceptance:

- пользователь понимает, что scan идет;
- пользователь понимает, почему нельзя запустить второй scan на тот же target;
- после completion данные обновляются без ручных танцев.

### 3. Mode Clarity

Пользователь должен понимать, какой режим работает:

- demo/mock;
- LAB_MODE;
- real scanners.

Что сделать:

- добавить mode indicator;
- не называть mock flow настоящим recon;
- убрать или ослабить UI-элементы, которые выглядят как готовые фичи, но backend их не поддерживает.

Примеры:

- notification channel;
- статичные счетчики sidebar;
- fake user card, если он выглядит как настоящая auth.

### 4. Frontend CI

Стабилизировать frontend checks.

Нужно:

```text
bun install
bun run build
bun run lint, если lint реально применим
```

Acceptance:

- PR падает, если TypeScript/frontend build сломан;
- frontend job не требует поднятого backend;
- logs понятно показывают, где ошибка.

## Задачи для ikarpenko

Фокус: backend intelligence/risk/report слой.

Ikarpenko может подключиться позже, поэтому задачи должны быть отдельными и не конфликтовать с frontend работой ahorsov.

### 1. Risk Scoring

Сделать первый объяснимый risk score.

Факторы:

- severity finding;
- asset is alive;
- sensitive hostname keywords:
  - `admin`;
  - `auth`;
  - `login`;
  - `vpn`;
  - `sso`;
  - `backup`;
  - `staging`;
- количество findings на asset;
- source tool.

Результат должен быть не только числом, но и списком reasons.

Acceptance:

- есть unit tests;
- score deterministic;
- reasons можно потом показать в UI или использовать для AI summary;
- scanner adapters не меняются.

### 2. AI Summary Input Contract

Подготовить structured payload для будущего AI summary.

Важно: пока не подключать реальную нейросеть и не добавлять API keys.

Payload должен строиться только из evidence в БД:

- scan target;
- assets;
- technologies/services;
- findings;
- top risks;
- recommendations;
- risk reasons.

Acceptance:

- есть функция/builder payload;
- есть unit test на форму payload;
- payload не содержит огромных raw dumps;
- каждое утверждение связано с asset/finding/evidence.

### 3. Report Model Improvements

Сделать `RiskReport` ближе к defensive summary.

`top_risks` должен стать стабильной структурой:

```text
title
severity
affected_assets
reason
recommended_action
```

Acceptance:

- existing frontend не ломается;
- есть tests для empty findings, low/info findings, high finding на sensitive asset;
- report отвечает на вопрос: что защищать первым и почему.

### 4. API Error Envelope

Подготовить единый формат ошибок backend.

Пример:

```json
{
  "error": {
    "code": "TARGET_NOT_ALLOWED",
    "message": "Target is not allowed",
    "details": {}
  }
}
```

Покрыть:

- target validation failed;
- target not allowed;
- active scan already running;
- scan not found;
- report not found.

Acceptance:

- `400`, `404`, `409` возвращают единый JSON envelope;
- successful DTO не меняются;
- frontend продолжает работать.

## Общие запреты на месяц

- Не делать installer.
- Не подключать реальный AI API.
- Не включать `nmap` по умолчанию.
- Не добавлять много scanner tools.
- Не включать aggressive nuclei templates.
- Не делать большую auth/user system.
- Не делать большой несвязанный refactor.

## Definition of Done на месяц

К концу месяца должно быть можно показать:

1. Запуск через Docker.
2. Safe scan по allowlisted target.
3. Нормальный progress/status.
4. Assets UI.
5. Findings UI или честный empty state.
6. Report UI.
7. Первый rule-based risk score/reasons.
8. Подготовленный AI summary input contract.
9. Зеленый CI.

Если это есть, проект можно считать MVP-кандидатом.
