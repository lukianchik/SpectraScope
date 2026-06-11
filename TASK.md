Ты работаешь в пустом репозитории нового проекта SpectraScope.

Нужно начать разработку MVP-платформы прикладной киберразведки и анализа внешней поверхности атаки. Цель проекта: пользователь вводит домен, система запускает безопасный pipeline сбора внешних активов и базовых security findings, сохраняет результаты в БД и показывает их через API. Это не автопентест и не инструмент эксплуатации. Сканирование должно предполагаться только по разрешённым целям.

На первом этапе НЕ нужно делать полноценный продукт целиком. Нужно создать качественный стартовый каркас проекта, который потом можно развивать.

Стек проекта:
Backend: Python 3.11+, FastAPI, SQLAlchemy, Alembic, Pydantic.
Task queue: Redis + Celery.
Database: PostgreSQL.
Frontend пока можно не реализовывать полностью, но нужно заложить папку frontend и минимальный README для будущего React/Vite-приложения.
Infrastructure: Docker, docker-compose.
Scanner tools на первом этапе реализовать как адаптеры-заглушки или безопасные wrappers: subfinder, httpx, nuclei, nmap. Не нужно выполнять агрессивные действия. Если бинарник не установлен, адаптер должен возвращать понятную ошибку или mock-результат в dev-режиме.

Сначала изучи репозиторий. Если он пустой, создай структуру:

spectrascope/
backend/
app/
main.py
core/
api/
models/
schemas/
services/
scanners/
workers/
db/
alembic/
requirements.txt
Dockerfile
frontend/
README.md
docker-compose.yml
.env.example
README.md

Реализуй backend-каркас:

1. FastAPI-приложение.
2. Healthcheck endpoint:
   GET /health
3. Endpoint запуска сканирования:
   POST /api/scans/start
4. Endpoint получения статуса:
   GET /api/scans/{scan_id}
5. Endpoint получения активов:
   GET /api/scans/{scan_id}/assets
6. Endpoint получения уязвимостей/findings:
   GET /api/scans/{scan_id}/findings
7. Endpoint получения отчёта:
   GET /api/scans/{scan_id}/report

Модели БД:

Scan:

* id UUID
* target string
* status string: created, running, completed, failed
* scan_profile string
* created_at
* started_at
* finished_at
* error_message nullable

Asset:

* id UUID
* scan_id FK
* hostname string
* ip nullable
* is_alive bool
* http_status nullable
* title nullable
* technologies nullable JSON
* created_at

Service:

* id UUID
* asset_id FK
* port int
* protocol string
* service_name nullable
* product nullable
* version nullable
* banner nullable

Finding:

* id UUID
* scan_id FK
* asset_id FK nullable
* source_tool string
* template_id nullable
* name string
* severity string: critical, high, medium, low, info
* description nullable
* matched_at nullable
* cve nullable
* cvss nullable
* raw_json JSON nullable
* created_at

RiskReport:

* id UUID
* scan_id FK
* summary text
* top_risks JSON
* recommendations JSON
* created_at

Реализуй Celery worker:

Задача run_scan(scan_id):

1. Меняет статус scan на running.
2. Валидирует target.
3. Запускает pipeline:

   * subdomain discovery adapter;
   * alive hosts adapter;
   * nuclei findings adapter;
   * optional nmap adapter, но пока можно оставить disabled by default.
4. Сохраняет assets и findings в БД.
5. Считает простой risk_score или формирует top_risks по severity.
6. Создаёт RiskReport с простым шаблонным summary без подключения реального AI.
7. Меняет статус scan на completed.
8. При ошибке пишет error_message и ставит status failed.

Очень важно:

* Не выполнять эксплуатацию уязвимостей.
* Не добавлять агрессивные nmap-флаги.
* Не запускать сканирование внутренних IP по умолчанию.
* Добавить явную валидацию домена.
* Добавить комментарий в README, что инструмент предназначен только для разрешённых целей.
* Все subprocess-вызовы делать безопасно: без shell=True, с timeout, обработкой ошибок и логированием.

Scanner adapters:

Создай интерфейс/базовый подход для адаптеров в backend/app/scanners/.

Нужны файлы:

* base.py
* subfinder.py
* httpx.py
* nuclei.py
* nmap.py

Каждый adapter должен возвращать нормализованный Python-объект, а не сырой текст.

Пример:
SubfinderResult:

* hostname

HttpxResult:

* hostname
* url
* status_code
* title
* technologies

NucleiFinding:

* host
* name
* severity
* template_id
* description
* cve
* raw_json

Если внешние инструменты не установлены, в dev-режиме можно вернуть mock-данные, чтобы весь pipeline можно было проверить без реального сканирования.

Docker-compose:

Сервисы:

* backend
* worker
* postgres
* redis

Backend должен быть доступен на localhost:8000.
Swagger должен быть доступен на /docs.

.env.example должен содержать:

* DATABASE_URL
* REDIS_URL
* CELERY_BROKER_URL
* CELERY_RESULT_BACKEND
* APP_ENV
* ENABLE_REAL_SCANNERS=false

README должен содержать:

1. Что это за проект.
2. Как запустить:
   docker compose up --build
3. Как открыть API:
   http://localhost:8000/docs
4. Как запустить тестовый scan через curl.
5. Ограничение: использовать только на своих или разрешённых целях.
6. Что реализовано в MVP-каркасе.
7. Что нужно делать дальше.

Качество кода:

* Пиши аккуратную структуру.
* Используй type hints.
* Разделяй API, models, schemas, services, scanners, workers.
* Не складывай всю логику в main.py.
* Добавь базовое логирование.
* Добавь обработку ошибок.
* Добавь минимальные unit tests, если это не сильно увеличит объём.
* После создания файлов проверь, что docker-compose и backend выглядят логично.
* В конце дай краткое summary: какие файлы созданы, как запустить, какие следующие шаги.

Начни с реализации backend + docker-compose + mock scanner pipeline. Не делай frontend, кроме папки frontend/README.md.
