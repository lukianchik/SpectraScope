# Local security lab / Локальная лаборатория

## English

The lab contains intentionally vulnerable demo services for testing SpectraScope. It is local-only: never expose it to the internet or use it against third-party systems.

~~~bash
cd lab
docker compose up --build
~~~

Endpoints:

- <http://localhost:8089> — mock admin panel;
- <http://localhost:8090> — legacy service;
- <http://localhost:8091> — directory listing;
- <http://localhost:8092> — OWASP Juice Shop.

For host-based routing on port 8088, add entries from [hosts.example](hosts.example). The local-real profile can scan perimeter.lab.local:8088; it expands only to ALLOWED_LAB_TARGETS.

Expected findings: exposed admin panel, legacy service, directory listing and missing security headers. Local Nuclei templates perform GET requests only.

## Русский

Лаборатория содержит намеренно уязвимые демонстрационные сервисы для проверки SpectraScope. Она предназначена только для локального запуска: не публикуйте её в интернете и не используйте против сторонних систем.

~~~bash
cd lab
docker compose up --build
~~~

Адреса:

- <http://localhost:8089> — тестовая админ-панель;
- <http://localhost:8090> — устаревший сервис;
- <http://localhost:8091> — открытый список файлов;
- <http://localhost:8092> — OWASP Juice Shop.

Для маршрутизации по именам на порту 8088 добавьте записи из [hosts.example](hosts.example). Профиль local-real может сканировать perimeter.lab.local:8088, который раскрывается только в цели из ALLOWED_LAB_TARGETS.

Ожидаемые находки: открытая админ-панель, устаревший сервис, directory listing и отсутствующие security headers. Локальные шаблоны Nuclei выполняют только GET-запросы.
