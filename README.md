# NYU Campus Marketplace

[![API CI/CD](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/api.yml/badge.svg)](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/api.yml)
[![MongoDB CI/CD](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/mongo.yml/badge.svg)](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/mongo.yml)
[![Test Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)](./services/api/tests/)

A full-stack secondhand marketplace web application designed for NYU students to buy, sell, and trade items within their campus community. Built with Flask, MongoDB, and Docker.

---

## Project Overview

NYU Campus Marketplace is a containerized web platform that enables students to:
- 🛍️ **Browse Listings**: Search and filter items by category and campus location
- 📝 **Post Items**: Create listings with multiple images, descriptions, and meetup points
- 💬 **Message Sellers**: Real-time chat system for buyer-seller communication
- ❤️ **Save Favorites**: Bookmark items and manage personal wishlists
- 👤 **User Profiles**: Manage listings, avatars, and account settings
- 🏫 **Campus-Specific**: Filter by NYU Brooklyn/Tandon or Washington Square locations

### Core Features
- Email/password authentication with NYU email validation
- Category filtering (textbooks, furniture, electronics, dorm supplies, rentals, other)
- Course code tagging for textbook listings
- Image upload and carousel display
- Mark listings as sold
- Unread message notifications
- Responsive mobile-first design

---

## Team Members

- **Leo Li** - [Leo Li](https://github.com/LiShangcheng)
- **Leo Qian** - [Leo Qian](https://github.com/Leo-codingMaster)
- **Hanjun Deng** - [Hanjun Deng](https://github.com/Deng-Hanjun)

---

## System Architecture

This project consists of two main subsystems:

### 1️⃣ Flask API (services/api/)

**Purpose**: RESTful backend providing all application logic and endpoints

**Technology Stack**:
- Python 3.12
- Flask 3.0.2
- PyMongo 4.7.0+
- Werkzeug 3.0.1

**Docker Image**: [leoq0724/marketplace-api:latest](https://hub.docker.com/r/leoq0724/marketplace-api)

**Key Responsibilities**:
```
# 1. User Authentication
POST /api/auth/register  # Create user account
POST /api/auth/login     # Authenticate and get session

# 2. Listing Management
GET /api/listings        # Fetch filtered listings
POST /api/listings       # Create new listing
PUT /api/listings/<id>   # Update listing (mark as sold)

# 3. Messaging System
POST /api/threads        # Create conversation
GET /api/threads/<user_id>/messages  # Fetch messages
POST /api/messages       # Send message

# 4. Favorites
POST /api/favorites      # Add to wishlist
DELETE /api/favorites/<id>  # Remove from wishlist
```

---

### 2️⃣ MongoDB Database (services/mongo/)

**Purpose**: Persistent data storage with automatic seed data initialization

**Technology**: MongoDB 7

**Docker Image**: [leoq0724/marketplace-mongo:latest](https://hub.docker.com/r/leoq0724/marketplace-mongo)

**Database Schema**:

#### Collection: items
```javascript
{
  "_id": ObjectId("..."),
  "title": "CS-UY 1134 Textbook",
  "price": 45.00,
  "description": "Used for one semester, excellent condition",
  "category": "textbook",
  "course_code": "CS-UY 1134",
  "meetup_point": "Rogers Hall",
  "community_id": "1",
  "user_id": "user123",
  "user": {
    "id": "user123",
    "nickname": "Alice",
    "verify_status": "email_verified"
  },
  "images": ["/static/uploads/abc123_textbook.jpg"],
  "status": "active",
  "created_at": "2024-12-05T10:30:00Z"
}
```

#### Collection: threads
```javascript
{
  "_id": ObjectId("..."),
  "buyer_id": "user123",
  "seller_id": "user456",
  "listing_id": ObjectId("..."),
  "created_at": "2024-12-05T14:20:00Z"
}
```

#### Collection: messages
```javascript
{
  "_id": ObjectId("..."),
  "thread_id": ObjectId("..."),
  "sender_id": "user123",
  "receiver_id": "user456",
  "content": "Is this still available?",
  "is_read": false,
  "created_at": "2024-12-05T14:21:00Z"
}
```

---

## 🔄 Complete Data Flow

### 1️⃣ User Browses Listings
```
User visits homepage
    → GET /api/listings?community_id=1&category=textbook
    → Flask queries MongoDB items collection
    → Returns filtered active listings
    → Frontend renders listing cards with images
```

### 2️⃣ User Creates New Listing
```
User fills form and uploads images
    → POST /api/listings
    → Flask receives FormData with files
    → Saves images to /static/uploads/
    → Creates MongoDB document in items collection
    → Returns listing object to frontend
    → Refreshes listing view
```

### 3️⃣ User Contacts Seller
```
# Step 1: Create or find conversation thread
POST /api/threads
{
  "buyer_id": "user123",
  "seller_id": "user456", 
  "listing_id": "listing789"
}
    → Check if thread exists
    → Create new thread if needed
    → Return thread_id

# Step 2: Send message
POST /api/messages
{
  "thread_id": "thread_abc",
  "sender_id": "user123",
  "content": "Is this available?"
}
    → Save to messages collection
    → Mark as unread for receiver
    → Return message object

# Step 3: Fetch conversation
GET /api/threads/<thread_id>/messages?user_id=user456
    → Load all messages in thread
    → Mark messages as read for user456
    → Return message list
```

### 4️⃣ User Marks Item as Sold
```
User clicks "Mark as Sold Out"
    → PUT /api/listings/<id>
    → Verify user is owner
    → Update status to "sold"
    → Remove from all users' favorites
    → Hide from main feed
```

---

## 🗄️ Database Design

### Main Database: marketplace

**Purpose**: Single source of truth for all application data

#### In-Memory State (Not Persisted)
The following data is stored in memory during runtime:
```
users = {}  # Demo user accounts (register/login)
auth_tokens = {}  # Session tokens
favorites = {}  # User favorites mapping
reports = []  # Content reports
communities = [...]  # Static campus locations
```

**Important Notes**:
- User authentication is demo-only (passwords in memory, not hashed)
- Favorites are not persisted across restarts
- In production, these would be MongoDB collections
- Only items, threads, and messages are persisted

---

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Git

### Local Development Setup

1. Clone the repository
```bash
git clone https://github.com/swe-students-fall2025/5-final-reallyawesome.git
cd 5-final-reallyawesome
```

2. Create environment configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit .env with your configuration (see [Environment Variables](#-environment-variables) section below for details):
```
MONGO_URI=mongodb://mongo:27017
MONGO_DB=marketplace
PORT=5001
```

3. Build and start all services
```bash
docker compose up --build
```

This command will:
- Build Docker images for API and MongoDB
- Initialize MongoDB with seed data
- Start API on http://localhost:5002
- Create persistent volume for MongoDB data

4. Access the application

Open your browser to:
```
http://localhost:5002
```

### Running API Only (Development Mode)

For faster iteration without Docker:
```bash
cd services/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export USE_MOCK_DB=1
python app.py
```

The API will start on http://localhost:5000.

---

## 🧪 Running Tests

All tests use pytest with coverage reporting:
```bash
cd services/api
pytest --cov=. --cov-report=term --cov-report=xml
```

To verify coverage threshold (80%):
```bash
coverage report --fail-under=80
```

**Test Coverage Includes**:
- Authentication endpoints (register/login)
- Listing CRUD operations
- Search and filtering
- Messaging system
- Favorites management
- File upload handling

---

## ⚙️ Environment Variables

### Creating Your .env File

A template file is provided in the repository:
```bash
cp .env.example .env
```

Then edit `.env` with your configuration.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| MONGO_URI | MongoDB connection string | mongodb://mongo:27017 |
| MONGO_DB | Database name | marketplace |
| PORT | API server port | 5000 |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| USE_MOCK_DB | Use in-memory database for testing | 0 |

### Example .env File
```
MONGO_URI=mongodb://mongo:27017
MONGO_DB=marketplace
PORT=5001
```

### MongoDB Atlas Configuration (Cloud Database)

For production deployment with MongoDB Atlas:

1. Create a free cluster at MongoDB Atlas
2. Whitelist your IP or allow access from anywhere
3. Get your connection string
4. Update .env:
```
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>
MONGO_DB=marketplace
```
5. In docker-compose.yml, comment out local mongo service

---

## 🐳 Docker Images

Pre-built images are available on Docker Hub:

### API Image
```bash
docker pull leoq0724/marketplace-api:latest
```
View on Docker Hub: https://hub.docker.com/r/leoq0724/marketplace-api

### MongoDB Image
```bash
docker pull leoq0724/marketplace-mongo:latest
```
View on Docker Hub: https://hub.docker.com/r/leoq0724/marketplace-mongo

### Manual Build Commands
```bash
# Build API
docker build -f services/api/Dockerfile -t leoq0724/marketplace-api:latest .

# Build MongoDB
docker build -f services/mongo/Dockerfile -t leoq0724/marketplace-mongo:latest services/mongo/
```

---

## 🔄 CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment.

### Workflow 1: API Pipeline (.github/workflows/api.yml)

**Trigger**: Push or PR to main/master branch

**Steps**:
```
1. Run Tests
   - Install Python 3.12
   - Install dependencies
   - Run pytest with coverage
   - Verify 80% coverage threshold

2. Build Docker Image
   - Set up Docker Buildx
   - Build marketplace-api image
   - Test build on PRs
   - Push to Docker Hub on main branch

3. Deploy (Placeholder)
   - SSH into DigitalOcean droplet
   - Pull latest image
   - Restart container with new image
```

### Workflow 2: MongoDB Pipeline (.github/workflows/mongo.yml)

**Trigger**: Push or PR to main/master branch

**Steps**:
```
1. Build Docker Image
   - Build MongoDB image with seed data
   - Test build on PRs
   - Push to Docker Hub on main branch

2. Deploy (Placeholder)
   - SSH into DigitalOcean droplet
   - Pull latest image
   - Restart MongoDB container
```

### Required GitHub Secrets

Configure in Settings > Secrets and variables > Actions:

| Secret | Purpose |
|--------|---------|
| DOCKERHUB_USERNAME | Docker Hub username |
| DOCKERHUB_TOKEN | Docker Hub access token |
| DO_HOST | DigitalOcean droplet IP |
| DO_SSH_KEY | SSH private key for deployment |
| MONGO_URI | Production MongoDB URI |

---

## 📊 Database Seeding

MongoDB automatically seeds initial data on first startup via services/mongo/initdb/init.js:
```javascript
db = db.getSiblingDB('marketplace');
db.items.insertMany([
  {
    name: 'Welcome',
    title: 'Welcome',
    price: 0,
    description: 'Sample item',
    created_at: new Date().toISOString(),
    category: 'other',
    meetup_point: 'Campus Center',
    user_id: '1',
    status: 'active'
  },
  {
    name: 'Notebook',
    title: 'Notebook',
    price: 5.5,
    description: 'Stationery',
    created_at: new Date().toISOString(),
    category: 'textbook',
    meetup_point: 'Library',
    user_id: '2',
    status: 'active'
  }
]);
```

This ensures demo data is available immediately after deployment.

---

## 🎨 Features

### Core Functionality
- User registration and authentication (NYU email required)
- Browse listings with filters (category, location, search)
- Post new listings with multiple images
- Real-time messaging between buyers and sellers
- Favorites/wishlist management
- Profile management with avatar uploads
- Mark listings as sold out
- Unread message badge notifications
- Search history and popular searches

### User Experience
- Responsive mobile-first design
- Modern gradient UI with cyber-inspired aesthetics
- Real-time search with auto-suggest
- Campus-specific location filtering (Brooklyn vs WSQ)
- Image carousel for multi-photo listings
- Persistent chat threads
- Notification system for new messages

---

## 🛠️ Technology Stack

- Backend: Flask 3.0.2, Python 3.12
- Database: MongoDB 7
- Frontend: Vanilla JavaScript, HTML5, CSS3
- Containerization: Docker, Docker Compose
- CI/CD: GitHub Actions
- Testing: Pytest 8.1.1, pytest-cov 4.1.0
- Image Registry: Docker Hub

---

## 📡 API Endpoints

### Authentication
```
POST /api/auth/register    # Create new user (requires @nyu.edu email)
POST /api/auth/login       # Authenticate user
```

### Communities
```
GET /api/communities       # List all campus locations
GET /api/communities/<id>  # Get specific community
```

### Listings
```
GET /api/listings                      # Fetch listings (supports filters)
POST /api/listings                     # Create new listing
GET /api/listings/<id>                 # Get listing details
PUT /api/listings/<id>                 # Update listing (owner only)
GET /api/listings/search?q=<query>     # Search listings
GET /api/users/<user_id>/listings      # Get user's listings
```

**Query Parameters for GET /api/listings**:
- category: Filter by category (textbook, furniture, etc.)
- community_id: Filter by campus location (1 or 2)
- status: Filter by status (active, sold, all)
- q: Search query

### Messaging
```
POST /api/threads                          # Create conversation thread
GET /api/threads/<user_id>                 # Get user's threads
GET /api/threads/<thread_id>/messages      # Get messages (marks as read)
POST /api/messages                         # Send message
GET /api/messages/<user_id>/unread-count   # Get unread count
```

### Favorites
```
POST /api/favorites                         # Add to favorites
DELETE /api/favorites/<listing_id>          # Remove from favorites
GET /api/users/<user_id>/favorites          # Get user favorites
```

### User Profile
```
GET /api/users/<user_id>                    # Get user profile
POST /api/users/<user_id>/avatar            # Upload avatar
```

### Statistics
```
GET /api/stats/dashboard    # Get dashboard stats
GET /api/stats/categories   # Get category breakdown
```

---

## 🔒 Security Notes

**This is a demonstration project. The following are NOT suitable for production:**

- Passwords stored in plaintext (no bcrypt/hashing)
- No CSRF protection
- Session management in memory (not persistent)
- File uploads without virus scanning
- No rate limiting on endpoints
- Direct MongoDB queries without query sanitization

**Production Recommendations**:
- Use bcrypt for password hashing
- Implement JWT tokens with refresh mechanism
- Add Redis for session storage
- Use CDN for file uploads (Cloudinary, AWS S3)
- Add rate limiting middleware (Flask-Limiter)
- Implement input validation with marshmallow
- Use HTTPS with SSL certificates

---

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.