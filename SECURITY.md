# Security / Безопасность

## English

Use SpectraScope only on assets you own or are authorized to assess. Do not expose the bundled vulnerable lab to an untrusted network.

Report vulnerabilities privately to the repository owner. Include the affected version, sanitized reproduction steps, impact and suggested mitigation. Do not publish credentials, target names or exploit evidence in an issue.

Production deployments must enable authentication, use unique secrets, secure cookies and TLS, keep PostgreSQL/Redis private, test backups and leave real scanners disabled until their allowlist and outbound policy are reviewed.

## Русский

Используйте SpectraScope только для собственных или явно разрешённых систем. Не публикуйте встроенную уязвимую лабораторию в недоверенной сети.

Сообщайте об уязвимостях владельцу репозитория приватно. Укажите версию, обезличенные шаги воспроизведения, влияние и возможное исправление. Не размещайте в issues секреты, названия реальных целей и эксплуатационные данные.

В production обязательно включите аутентификацию, уникальные секреты, secure cookies и TLS; не публикуйте PostgreSQL/Redis; проверяйте резервные копии и не включайте реальные сканеры до проверки allowlist и сетевой политики.
