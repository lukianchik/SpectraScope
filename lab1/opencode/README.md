# OpenCode: файлы лабораторной

В этой папке находятся настройки и инструкции OpenCode для работы с SpectraScope. Полный отчёт по заданиям и результатам лабораторной находится в [README папки lab1](../README.md).

## Файлы

- [`AGENTS.md`](AGENTS.md) — рабочие правила OpenCode для этого проекта.
- [`AGENTS_RU.md`](AGENTS_RU.md) — русское пояснение к правилам.
- [`opencode.json`](opencode.json) — разрешения команд и подключение локальной модели.
- [`opencode_RU.md`](opencode_RU.md) — объяснение настроек конфигурации.
- [Skill проверки](.agents/skills/spectrascope-review/SKILL.md) — чек-лист проверки изменений.
- [Пояснение skill](.agents/skills/spectrascope-review/SKILL_RU.md) — описание чек-листа на русском.
- [`report/`](report/) — документы `intent`, `spec`, `plan`, отчёты Word и материалы экспериментов.

## Запуск

Из корневой папки репозитория выполните:

```powershell
cd lab1/opencode
opencode
```

OpenCode автоматически загрузит расположенные здесь `AGENTS.md`, `opencode.json` и skill.
