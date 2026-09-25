# Plan: реализация scan preview

## Порядок изменений

1. Сначала добавить падающие тесты в `tests/test_scan_profiles.py` для чистого builder стадий и в `tests/test_scan_lifecycle.py` для endpoint, policy-отказов и отсутствия side effects.
2. В `backend/app/services/scan_profiles.py` добавить чистое построение стадий для каждого профиля; перевести `scan_pipeline.py` на этот источник истины.
3. В `backend/app/schemas/scan.py` добавить `ScanPreviewResponse` и тип стадии.
4. В `backend/app/api/scans.py` добавить `POST /preview`, переиспользовать `ScanStartRequest`, `effective_settings`, `authorize_target` и profile validation. Не вызывать `_expire_stale_scans`, `db.add`, `db.commit` или `run_scan.delay`.
5. Отделить статическую проверку network policy от DNS-зависимой проверки. Preview вызывает только чистую часть.
6. Добавить клиентский метод в `frontend/src/shared/api/scans.ts` и preview-блок в `frontend/src/StartScan` с отдельными кнопками Preview и Start.
7. Обновить API/пользовательскую документацию и выполнить полную проверку.

## Проверки

```powershell
$env:PYTHONPATH = "backend"
pytest -q tests/test_scan_profiles.py tests/test_scan_lifecycle.py tests/test_target_policy.py tests/test_network_policy.py
pytest -q
bun run --cwd frontend lint
bun run --cwd frontend build
```

## Политики: совет и принуждение

- Навык `spectrascope-review` напоминает проверить side effects, контракты, тесты и утечки данных. Это совет: текст можно проигнорировать.
- Разрешения OpenCode требуют подтверждения правок/неизвестных команд и запрещают `git push` и удаление Docker volumes. Это граница действий агента.
- CI должен принуждать тестами: preview не вызывает сеть/Celery/scanners; изменения policy требуют negative tests.
- Pre-tool hook в командной среде должен блокировать реальные scanner-команды с не-lab целью. Одной текстовой инструкции для этого недостаточно.

## Гейты и переходы

- Утверждённый `intent.md` запускает спецификацию.
- Утверждённый `spec.md` запускает планирование.
- Коммит только с падающими тестами фиксирует проверяемое ожидание до реализации.
- Коммит реализации допускается к ревью после зелёных локальных проверок.
- Независимый reviewer даёт verdict; merge выполняет человек.

## Мультиагентность и экономика

Одна сессия достаточна для схем, service builder и документации: файлы тесно связаны, а передача контекста дороже локальной работы. Отдельный свежий агент оправдан для security-review отсутствия side effects и сопоставления preview с pipeline. Параллельный frontend-агент уместен только после стабилизации API-контракта. Это ограничивает дорогую мультиагентность двумя независимыми задачами вместо fan-out на каждый файл.

## Откат

Endpoint и UI не меняют схему БД. Откат — удалить маршрут/клиентский preview и вернуть pipeline к прежнему перечислению стадий; существующий запуск сканов остаётся работоспособным.
