# Deployment Guide

Complete guide for deploying MongoDB and API to remote servers.

## Prerequisites

- Docker Hub account
- DigitalOcean account
- GitHub repository with Actions enabled

## Step 1: Configure GitHub Secrets

Add these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

1. **DOCKERHUB_USERNAME**: Your Docker Hub username
2. **DOCKERHUB_TOKEN**: Docker Hub access token (Account Settings → Security → New Access Token)
3. **DO_HOST**: DigitalOcean Droplet IP address (create in Step 2)
4. **DO_SSH_KEY**: SSH private key for connecting to Droplet
5. **MONGO_URI**: MongoDB connection string (e.g., `mongodb://your-droplet-ip:27017/marketplace`)

## Step 2: Create DigitalOcean Droplet

1. Visit https://cloud.digitalocean.com/
2. Create → Droplets
3. Configuration:
   - Image: Ubuntu 22.04 LTS
   - Plan: Basic ($6/month, 1GB RAM)
   - Datacenter: Choose nearest region
   - Authentication: SSH keys
4. Create Droplet
5. Record the IP address

## Step 3: Generate SSH Key

```powershell
ssh-keygen -t rsa -b 4096 -f ~/.ssh/do_deploy_key -N ""
```

Add public key to DigitalOcean:
```powershell
cat ~/.ssh/do_deploy_key.pub
```

Copy the output and add it when creating the Droplet, or manually:
```powershell
ssh-copy-id -i ~/.ssh/do_deploy_key.pub root@YOUR_DROPLET_IP
```

Add private key to GitHub Secrets:
```powershell
cat ~/.ssh/do_deploy_key
```

Copy the full output (including `-----BEGIN` and `-----END`) to GitHub Secrets as `DO_SSH_KEY`.

## Step 4: Install Docker on Droplet

```powershell
ssh root@YOUR_DROPLET_IP
```

On the Droplet:
```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl start docker
systemctl enable docker
mkdir -p /data/mongodb
```

## Step 5: Configure Firewall

In DigitalOcean Console:
1. Networking → Firewalls → Create Firewall
2. Add inbound rules:
   - Type: Custom TCP, Port: 27017 (MongoDB)
   - Type: Custom TCP, Port: 5000 (API)
   - Type: SSH, Port: 22
3. Apply to your Droplets

## Step 6: Push Code and Trigger CI/CD

```powershell
git add .
git commit -m "Add deployment configuration"
git push origin main
```

Check GitHub Actions tab to verify:
- ✅ MongoDB CI/CD: Build and push succeeded
- ✅ MongoDB CI/CD: Deploy succeeded
- ✅ API CI/CD: Tests passed (coverage ≥ 80%)
- ✅ API CI/CD: Build and push succeeded
- ✅ API CI/CD: Deploy succeeded

## Step 7: Verify Deployment

### Check MongoDB
```powershell
ssh root@YOUR_DROPLET_IP
docker ps
docker logs marketplace-mongo
```

### Check API
```powershell
curl http://YOUR_DROPLET_IP:5000/api/health
```

## Local Testing

### Run Tests
```powershell
cd services\api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pytest --cov=. --cov-report=term tests\test_api.py
```

Expected: Coverage ≥ 80%

### Build MongoDB Image Locally
```powershell
cd services\mongo
docker build -t marketplace-mongo:latest .
```

### Test Docker Compose
```powershell
cd ..\..
docker compose up --build
```

## Troubleshooting

- **Tests fail**: Ensure `USE_MOCK_DB=1` is set
- **Docker push fails**: Check Docker Hub credentials
- **Deploy fails**: Verify SSH key and Droplet IP in GitHub Secrets
- **Cannot connect**: Check firewall rules and port accessibility

