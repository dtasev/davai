# Davai Development & Testing Guidelines

This repository contains the Davai application (Django backend, React frontend, Authelia configuration, and MCP server).

## Running Tests

Do not run `pytest`, `python`, or `npm` directly on the host machine. Always use the active Docker Compose services for testing and backend commands.

### Backend Tests (Django / Pytest)

Run all backend tests:
```bash
docker compose exec backend pytest
```

Run a specific test file or test case:
```bash
docker compose exec backend pytest tracker/tests/test_api.py -k test_name
```

### Frontend Tests (Vitest)

Run all frontend tests:
```bash
docker compose exec frontend npm test -- --run
```

Run a specific test suite:
```bash
docker compose exec frontend npm test -- --run src/App.test.tsx
```

## Running Django Management Commands

Execute management commands inside the backend container:
```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py shell
```

## Environment & Services

- `backend`: Django Ninja REST & GraphQL API, MCP server
- `frontend`: Vite React SPA
- `authelia`: Authentication portal & OIDC IdP (`http://authelia:9091`)
- `postgres`: PostgreSQL database
- `nginx`: Local reverse proxy exposing the application on port 6477 (`http://127.0.0.1:6477`)
