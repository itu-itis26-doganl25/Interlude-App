# Interlude — Backend

Django + Django REST Framework backend for the Interlude social music app.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # then set SECRET_KEY

python manage.py makemigrations accounts catalogue rooms analytics
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

- API docs (Swagger): http://127.0.0.1:8000/api/docs/
- Admin: http://127.0.0.1:8000/admin/
- Health check: http://127.0.0.1:8000/api/health/

Run tests with coverage: `pytest`
Lint: `ruff check .`

### Optional: PostgreSQL and Azure Blob emulator

```bash
docker compose up -d
```
Then uncomment `DATABASE_URL` and `AZURE_CONNECTION_STRING` in `.env`.
Without them, the app uses SQLite and stores media on local disk.

## Project layout

| App | Owner | WBS | Contents |
|---|---|---|---|
| `config/` | A, B | 1.4 | settings, URLs, WSGI/ASGI |
| `apps/accounts` | C | 2.x, 3.1, 4.x | custom `User` with `role` |
| `apps/catalogue` | A | 5–8 | `Album`, `Song`, upload validation |
| `apps/rooms` | D | 9–11 | `Room` (stub) |
| `apps/analytics` | E | 12 | `ListeningEvent` (stub) |

## Conventions

- Configuration comes only from environment variables / `.env`. No secrets in Git.
- Media files are stored under random names (`audio/<artist_id>/<uuid>.mp3`).
  In Azure the container is private and every URL is time-limited.
- A song can be published only after the musician confirms they hold the rights.
- Every new model or endpoint ships with tests; CI enforces backend coverage ≥ 70%.
- New API endpoints appear automatically in `/api/schema/` — frontend and mobile
  build against this schema.
