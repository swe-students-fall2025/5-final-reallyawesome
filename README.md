# NYU Campus Marketplace

[![API CI/CD](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/api.yml/badge.svg)](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/api.yml)
[![MongoDB CI/CD](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/mongo.yml/badge.svg)](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/mongo.yml)
[![Test Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)](./services/api/tests/)

A full-stack secondhand marketplace for NYU students to buy, sell, and trade campus items. Built with Flask, MongoDB, and Docker.

## 👥 Team

- **Leo Li** - [Leo Li](https://github.com/LiShangcheng)
- **Leo Qian** - [Leo Qian](https://github.com/Leo-codingMaster)
- **Hanjun Deng** - [Hanjun Deng](https://github.com/Deng-Hanjun)

## 📋 Features

- **Browse & Search**: Filter items by category, campus location, and keywords
- **Post Listings**: Create listings with images, descriptions, and course codes (for textbooks)
- **Messaging**: Real-time chat between buyers and sellers
- **Favorites**: Save items to wishlist
- **User Profiles**: Manage listings and avatars
- **Campus-Specific**: NYU Brooklyn/Tandon and Washington Square locations

## 🏗️ System Architecture

**Two subsystems:**

1. **Flask API** (`services/api/`) - Python REST backend
   - Docker Image: [leoq0724/marketplace-api:latest](https://hub.docker.com/r/leoq0724/marketplace-api)
   - Port: 5001 (mapped to 5002 on host)

2. **MongoDB** (`services/mongo/`) - Data persistence
   - Docker Image: [leoq0724/marketplace-mongo:latest](https://hub.docker.com/r/leoq0724/marketplace-mongo)
   - Port: 27017 (mapped to 27018 on host)

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Run with Docker (Recommended)

```bash
git clone https://github.com/swe-students-fall2025/5-final-reallyawesome.git
cd 5-final-reallyawesome

# Create environment file
cp .env.example .env

# Start services
docker compose up --build
```

Open http://localhost:5002 in your browser.

### Run Locally (Development)

```bash
# Setup Python environment
cd services/api
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Use mock database for testing
export USE_MOCK_DB=1

# Start Flask dev server
python app.py
```

Open http://localhost:5000

## ⚙️ Configuration

### Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

**Required variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| MONGO_URI | MongoDB connection string | mongodb://mongo:27017 |
| MONGO_DB | Database name | marketplace |
| PORT | API server port | 5001 |

**Optional:**

| Variable | Description | Default |
|----------|-------------|---------|
| USE_MOCK_DB | Use in-memory DB for testing | 0 |

### Database Seeding

MongoDB automatically seeds initial data on startup via `services/mongo/initdb/init.js`:
- Sample "Welcome" item
- Sample "Notebook" item

## 🧪 Testing

Run all tests with coverage reporting:

```bash
cd services/api
pytest --cov=. --cov-report=term --cov-report=xml
```

Verify 80% coverage threshold:
```bash
coverage report --fail-under=80
```

**Test Coverage**: Authentication, listings, search, messaging, favorites (80%+)

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/listings` | GET/POST | Browse/create listings |
| `/api/auth/register` | POST | Register user |
| `/api/auth/login` | POST | Login user |
| `/api/threads` | POST/GET | Create/fetch message threads |
| `/api/messages` | POST/GET | Send/fetch messages |
| `/api/favorites` | POST/DELETE/GET | Manage wishlist |

See `services/api/app.py` for complete endpoint documentation.

## 🐳 Docker Images

Pre-built images available on Docker Hub:

```bash
# Pull and run API
docker pull leoq0724/marketplace-api:latest
docker run -p 5002:5001 leoq0724/marketplace-api:latest

# Pull and run MongoDB
docker pull leoq0724/marketplace-mongo:latest
docker run -p 27018:27017 leoq0724/marketplace-mongo:latest
```

Manual build:
```bash
docker build -f services/api/Dockerfile -t leoq0724/marketplace-api:latest .
docker build -f services/mongo/Dockerfile -t leoq0724/marketplace-mongo:latest services/mongo/
```

## 🔄 CI/CD Pipeline

GitHub Actions workflows trigger on push/PR to `main`:

- **api.yml**: Tests API, builds/pushes Docker image, deploys to DigitalOcean
- **mongo.yml**: Builds/pushes MongoDB image

Required secrets in GitHub:
- `DOCKERHUB_USERNAME` - Docker Hub account
- `DOCKERHUB_TOKEN` - Docker Hub token
- `DO_HOST` - DigitalOcean droplet IP
- `DO_SSH_KEY` - SSH private key
- `MONGO_URI` - Production MongoDB URI

## 📁 Project Structure

```
├── services/
│   ├── api/                 # Flask REST API
│   │   ├── app.py          # Main application
│   │   ├── db.py           # MongoDB interface
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── tests/          # Unit tests
│   └── mongo/              # MongoDB setup
│       ├── Dockerfile
│       └── initdb/         # Seed data
├── templates/              # HTML pages
├── static/                 # CSS/JavaScript
├── docker-compose.yml      # Service orchestration
└── .env.example            # Environment template
```

## 🔒 Security Notes

**Demo project - NOT production-ready:**

- Passwords stored in plaintext (no bcrypt)
- Session management in memory
- No CSRF protection
- No rate limiting

**Production TODO:**
- Add bcrypt password hashing
- Use JWT tokens with Redis sessions
- Implement CSRF protection
- Add rate limiting (Flask-Limiter)
- Input validation with Marshmallow
- HTTPS with SSL certificates

## 🐛 Troubleshooting

**Port conflicts?**
```bash
# Change host port in docker-compose.yml
ports:
  - "5003:5001"  # Use 5003 instead of 5002
```

**MongoDB connection fails?**
```bash
# Verify MongoDB is running
docker compose ps

# Check logs
docker compose logs mongo
```

**Tests fail locally?**
```bash
# Use mock database
export USE_MOCK_DB=1
pytest services/api/tests/
```

## 📄 License

GNU General Public License v3.0 - see LICENSE file for details.