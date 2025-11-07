# my-first-site

Личный сайт и инструкции по развёртыванию собственных сервисов.

## Архитектура

- **vaborin.com** — Личный сайт (GitHub Pages, index.html)
- **planka.vaborin.com** — Kanban-сервис Planka (Docker Compose + Caddy)

## Публичный доступ к Planka

В директории [`docs/planka-deployment.md`](docs/planka-deployment.md) описан полный процесс развёртывания kanban-сервиса [`Planka`](https://planka.app/) на своём сервере через GitHub Actions и Caddy. 

Сервис будет доступен по адресу **https://planka.vaborin.com**, а проверка GitHub Actions подтвердит, что он открывается из интернета.

### Основные компоненты конфигурации

- `planka/docker-compose.yml` — оркестрация Planka, PostgreSQL и Caddy
- `planka/.env.example` — переменные окружения (шаблон)
- `planka/Caddyfile` — конфигурация Caddy для двух доменов:
  - `vaborin.com` → личный сайт из GitHub Pages
  - `planka.vaborin.com` → reverse proxy к Planka
- `.github/workflows/planka-deploy.yml` — автоматизация деплоя

### Основные шаги развёртывания

1. Подготовить `.env` из `planka/.env.example` с доменом `planka.vaborin.com` и почтой для Let's Encrypt.
2. Создать GitHub secrets: `PLANKA_ENV_FILE`, `PLANKA_HOST`, `PLANKA_USER`, `PLANKA_SSH_KEY`, `PLANKA_REMOTE_PATH`, `PLANKA_PUBLIC_URL`.
3. Запустить деплой через Actions или пуш в ветку `main` — дождаться шага «Check public availability».

После завершения Planka будет доступна по адресу **https://planka.vaborin.com**.
