# my-first-site

Личный сайт и инструкции по развёртыванию собственных сервисов.

## Публичный доступ к Planka

В директории [`docs/planka-deployment.md`](docs/planka-deployment.md) описан полный процесс, как развернуть kanban-сервис [Planka](https://planka.app/) из этого репозитория на своём сервере через GitHub Actions и сделать его доступным в интернете. Там же находится пример `docker-compose.yml` и Caddy-конфигурация.

Основные шаги:

1. Подготовить файл переменных окружения по шаблону [`planka/.env.example`](planka/.env.example).
2. Создать секреты GitHub и настроить workflow [`planka-deploy.yml`](.github/workflows/planka-deploy.yml).
3. Запустить деплой через вкладку **Actions** или пуш в ветку `main`.

После выполнения этих шагов Planka будет доступна по адресу, указанному в `BASE_URL`.
