# Развёртывание Planka через GitHub

Этот репозиторий содержит готовые конфигурационные файлы, которые помогают автоматизировать развёртывание [Planka](https://planka.app/) на вашем сервере и публиковать сервис в интернет. Ниже приведён сценарий, основанный на официальной документации проекта, но адаптированный под хранение исходников в GitHub и доставку обновлений через GitHub Actions. Для публикации на статическом сайте доступна верстка из файла [`docs/planka-deployment.html`](planka-deployment.html).

## Что понадобится

1. **Аккаунт на GitHub** и репозиторий (можно использовать этот).
2. **Виртуальный или физический сервер** под управлением Linux с публичным IP-адресом, на который можно подключиться по SSH.
3. Установленные на сервере **Docker** и **Docker Compose plugin** (`docker compose`).
4. Настроенный DNS-запись на ваш домен, указывающая на IP-адрес сервера (например, `planka.example.com`).

## Структура репозитория

- `planka/docker-compose.yml` — основной файл оркестрации для Planka и PostgreSQL.
- `planka/.env.example` — шаблон переменных окружения. Реальный файл `.env` не коммитится, а создаётся из секретов GitHub.
- `.github/workflows/planka-deploy.yml` — workflow, который доставляет изменения на сервер и перезапускает контейнеры.
- `.gitignore` — исключает `planka/.env` из git.

## Подготовка `.env`

1. Скопируйте `planka/.env.example` в новый файл `planka/.env`.
2. Заполните значения:
   - `BASE_URL` — публичный URL сервиса, например `https://planka.example.com`.
   - `SECRET_KEY` — случайная строка длиной 32–64 символа.
   - Данные администратора (`ADMIN_*`).
   - Параметры PostgreSQL (`POSTGRES_*`).
   - SMTP-конфигурация, если нужна отправка почты.
3. **Не коммитьте** файл `planka/.env`. Вместо этого сохраните его содержимое как секрет в GitHub (см. ниже).

## Настройка секретов GitHub

Откройте «Settings → Secrets and variables → Actions» вашего репозитория и добавьте следующие секреты:

- `PLANKA_ENV_FILE` — полный текст вашего `planka/.env`.
- `PLANKA_HOST` — IP-адрес или доменное имя сервера.
- `PLANKA_USER` — SSH-пользователь, под которым будет выполняться деплой.
- `PLANKA_SSH_KEY` — приватный SSH-ключ (формат OpenSSH) для доступа к серверу.
- `PLANKA_REMOTE_PATH` — путь на сервере, куда будут загружаться файлы, например `/opt/planka`.

## Настройка сервера

1. Установите Docker и Compose plugin:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo apt-get install -y docker-compose-plugin
   sudo usermod -aG docker $USER
   ```
2. Создайте каталог под проект и убедитесь, что SSH-ключи позволяют записывать туда файлы:
   ```bash
   sudo mkdir -p /opt/planka
   sudo chown $USER:$USER /opt/planka
   ```
3. (Опционально) Настройте обратный прокси (например, Caddy или Nginx) для публикации Planka на 80/443 портах. Пример Caddyfile находится ниже.

## GitHub Actions workflow

Workflow `planka-deploy.yml` запускается вручную (`workflow_dispatch`) или автоматически при изменении файлов в папках `planka/`, `docs/` или самом workflow. Он:

1. Чекаутит репозиторий.
2. Восстанавливает файл `planka/.env` из секрета `PLANKA_ENV_FILE`.
3. Копирует `docker-compose.yml` и `.env` на сервер через `scp`.
4. Выполняет на сервере `docker compose pull` и `docker compose up -d`.

После успешного выполнения сервис станет доступен по адресу, указанному в `BASE_URL` (при условии правильно настроенного прокси).

## Пример Caddyfile

Если вы используете [Caddy](https://caddyserver.com/) как обратный прокси, сохраните файл `planka/Caddyfile` на сервере и включите его в основную конфигурацию Caddy:

```caddy
planka.example.com {
  encode gzip
  reverse_proxy 127.0.0.1:1337
}
```

Caddy автоматически выпустит сертификат Let's Encrypt и будет проксировать запросы к контейнеру Planka.

## Проверка установки

1. Запустите workflow «Deploy Planka» из вкладки Actions либо дождитесь автоматического запуска после пуша.
2. На сервере убедитесь, что контейнеры работают:
   ```bash
   docker compose ps
   docker compose logs -f planka
   ```
3. Откройте браузер и перейдите по адресу `BASE_URL`. Авторизуйтесь с данными администратора, указанными в `.env`.

## Обновление сервиса

- Измените нужные файлы в репозитории и запустите workflow — GitHub Actions сделает rolling update.
- Для обновления версии достаточно поменять тег Docker-образа в `planka/docker-compose.yml` (например, `ghcr.io/plankanban/planka:latest`).

## Безопасность

- Меняйте пароль администратора после первого входа.
- Используйте отдельный почтовый ящик для отправки уведомлений.
- Регулярно делайте резервные копии томов Docker (`postgres-data`, `attachments` и др.).

## Полезные ссылки

- Официальная документация: <https://docs.planka.app/>
- Репозиторий GitHub: <https://github.com/plankanban/planka>
