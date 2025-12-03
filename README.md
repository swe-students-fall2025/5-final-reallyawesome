# NYU Marketplace (Flask + Mongo)

[![API CI/CD](https://github.com/USER/REPO/actions/workflows/api.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/api.yml)
[![Mongo CI/CD](https://github.com/USER/REPO/actions/workflows/mongo.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/mongo.yml)

Simple two-subsystem project: a Flask API (Python) and a MongoDB database. Both are containerized, tested, and ready for CI/CD to Docker Hub and DigitalOcean.

## Subsystems
- **API (services/api)**: Flask app exposing `/api/health` and `/api/items` (CRUD-lite). Image: `docker.io/<your-dockerhub-username>/marketplace-api:latest`.
- **Mongo (services/mongo)**: MongoDB with seed data via `initdb/init.js`. Image: `docker.io/<your-dockerhub-username>/marketplace-mongo:latest`.

## Teammates
- [Your Name](https://github.com/your-profile)

## Quickstart (local)
```bash
git clone <repo>
cd 5-final-reallyawesome
cp .env.example .env
# adjust env if needed
docker compose up --build
```
- API available at `http://localhost:5000/api/health` and `/api/items`.
- Mongo exposed at `mongodb://localhost:27017` (data volume persisted).

## Running API only (dev)
```bash
cd services/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export USE_MOCK_DB=1  # optional for offline dev
python app.py
```

## Tests
```bash
cd services/api
pytest --cov=.
```

## Environment Variables
- `MONGO_URI` (default `mongodb://mongo:27017`)
- `MONGO_DB` (default `marketplace`)
- `PORT` (API port, default `5000`)
- `USE_MOCK_DB` (optional, `1` enables mongomock for tests/dev)

## Docker Hub
- API image: `docker.io/<your-dockerhub-username>/marketplace-api:latest`
- Mongo image: `docker.io/<your-dockerhub-username>/marketplace-mongo:latest`

## CI/CD (GitHub Actions)
- `.github/workflows/api.yml`: installs deps, runs tests with coverage, builds/pushes API image, placeholder DO deploy step.
- `.github/workflows/mongo.yml`: builds/pushes Mongo image, placeholder DO deploy step.

Set repo secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, and any DigitalOcean keys you use for deploy (e.g., `DO_API_TOKEN`).

## Deployment (DigitalOcean placeholder)
Replace the deploy steps in the workflows with your method (e.g., `doctl` to update an app or droplet). Ensure Docker Hub images are pushed before deploy.

## Seed Data
Mongo image copies `initdb/init.js` to `/docker-entrypoint-initdb.d`, seeding sample items when the DB first starts.

## Notes
- Static assets remain under `static/` and can be served by the Flask app.
- Adjust badges with your real GitHub org/repo path.
