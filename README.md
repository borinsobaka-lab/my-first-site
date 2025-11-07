# my-first-site

Личный сайт и инструкции по развёртыванию собственных сервисов.

## Публичный доступ к Planka

В директории [`docs/planka-deployment.md`](docs/planka-deployment.md) описан полный процесс, как развернуть kanban-сервис [Planka](https://planka.app/) из этого репозитория на своём сервере через GitHub Actions и сделать его доступным в интернете. Там же находится пример `docker-compose.yml` и Caddy-конфигурация.

Основные шаги:

1. Подготовить файл переменных окружения по шаблону [`planka/.env.example`](planka/.env.example) с доменом и почтой для TLS.
2. Создать секреты GitHub (включая `PLANKA_PUBLIC_URL` для проверки доступности) и настроить workflow [`planka-deploy.yml`](.github/workflows/planka-deploy.yml).
3. Запустить деплой через вкладку **Actions** или пуш в ветку `main` и дождаться шага «Check public availability».

После выполнения этих шагов Planka будет доступна по адресу, указанному в `BASE_URL`, а проверка GitHub Actions подтвердит, что сервис открывается из интернета.
