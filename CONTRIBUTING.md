# Contributing / Участие в разработке

## English

Keep changes focused and defensive. Never commit credentials, real customer targets, raw evidence or database dumps. Scanner changes must document authorization impact and include tests.

~~~bash
pip install -r backend/requirements-dev.txt
PYTHONPATH=backend pytest -q
cd frontend && bun install --frozen-lockfile && bun run lint && bun run build
~~~

## Русский

Делайте небольшие изменения, ориентированные на защиту. Не добавляйте в Git секреты, реальные цели клиентов, необработанные результаты сканирования и дампы баз данных. Изменения сканеров должны описывать влияние на область авторизации и сопровождаться тестами.
