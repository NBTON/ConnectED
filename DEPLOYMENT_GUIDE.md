# 🚀 ConnectED Deployment Guide

This comprehensive guide covers various deployment strategies for ConnectED, from development to production environments.

## 📋 Table of Contents

- [Local Development Setup](#local-development-setup)
- [Docker Deployment](#docker-deployment)
- [Cloud Platform Deployment](#cloud-platform-deployment)
- [Production Checklist](#production-checklist)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## 🛠️ Local Development Setup

### Prerequisites

1. **Node.js 20+**
   ```bash
   # Check version
   node --version

   # Using nvm (recommended)
   nvm install 20
   nvm use 20
   ```

2. **MongoDB**
   ```bash
   # Using Homebrew (macOS)
   brew install mongodb-community

   # Using Ubuntu/Debian
   sudo apt-get install mongodb

   # Start MongoDB service
   sudo systemctl start mongod
   ```

3. **Redis (Optional)**
   ```bash
   # Using Homebrew (macOS)
   brew install redis

   # Using Ubuntu/Debian
   sudo apt-get install redis-server

   # Start Redis service
   sudo systemctl start redis
   ```

### Environment Configuration

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Configure development environment:**
   ```bash
   # .env
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/conect-ed
   SESSION_SECRET=your-dev-session-secret
   CORS_ORIGIN=http://localhost:3000
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

1. **Configure production environment:**
   ```bash
   # .env.production
   NODE_ENV=production
   PORT=3000
   MONGODB_URI=mongodb://mongodb:27017/conect-ed
   SESSION_SECRET=your-production-session-secret-min-32-chars
   CORS_ORIGIN=https://yourdomain.com
   ```

2. **Deploy with Docker Compose:**
   ```bash
   # Build and start all services
   docker-compose up -d

   # View logs
   docker-compose logs -f app

   # Scale the application
   docker-compose up -d --scale app=3
   ```

3. **Update deployment:**
   ```bash
   # Pull latest changes and rebuild
   git pull
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Manual Docker Deployment

```bash
# Build production image
docker build -t connected:latest .

# Run with environment file
docker run -d \
  --name connected-app \
  --env-file .env.production \
  -p 3000:3000 \
  --network connected-network \
  connected:latest

# Run MongoDB container
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  --network connected-network \
  mongo:latest

# Run Redis container
docker run -d \
  --name redis \
  -p 6379:6379 \
  --network connected-network \
  redis:latest
```

## ☁️ Cloud Platform Deployment

### Heroku Deployment

1. **Create Heroku app:**
   ```bash
   heroku create your-connected-app
   ```

2. **Add MongoDB Atlas add-on:**
   ```bash
   heroku addons:create mongolab:sandbox
   ```

3. **Configure environment:**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   heroku config:set MONGODB_URI=$(heroku config:get MONGODB_URI)
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

### AWS Deployment

#### Using EC2 + Docker

1. **Launch EC2 instance:**
   ```bash
   # Ubuntu 20.04 LTS, t3.medium or larger
   aws ec2 run-instances \
     --image-id ami-0c02fb55956c7d316 \
     --instance-type t3.medium \
     --key-name your-key-pair
   ```

2. **Install Docker:**
   ```bash
   # On EC2 instance
   sudo yum update -y
   sudo amazon-linux-extras install docker
   sudo systemctl start docker
   sudo usermod -a -G docker ec2-user
   ```

3. **Deploy application:**
   ```bash
   # Copy files to instance
   scp -i your-key.pem -r . ec2-user@your-instance:/home/ec2-user/connected

   # Start application
   cd /home/ec2-user/connected
   docker-compose up -d
   ```

#### Using ECS Fargate

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name connected-cluster

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service --cli-input-json file://service-definition.json
```

### Google Cloud Platform

#### Using Cloud Run

```bash
# Build and push container
gcloud builds submit --tag gcr.io/your-project/connected

# Deploy to Cloud Run
gcloud run deploy connected \
  --image gcr.io/your-project/connected \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Using App Engine

1. **Create app.yaml:**
   ```yaml
   runtime: nodejs20
   env: standard
   instance_class: F2

   env_variables:
     NODE_ENV: production
     MONGODB_URI: your-mongodb-uri

   handlers:
     - url: /.*
       script: server.js
   ```

2. **Deploy:**
   ```bash
   gcloud app deploy
   ```

### Azure Deployment

#### Using Container Instances

```bash
# Create resource group
az group create --name connected-rg --location eastus

# Create container instance
az container create \
  --resource-group connected-rg \
  --name connected-app \
  --image your-registry/connected:latest \
  --dns-name-label connected-app \
  --ports 3000 \
  --environment-variables NODE_ENV=production MONGODB_URI=your-mongodb-uri
```

## ✅ Production Checklist

### Pre-Deployment

- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Session secret is strong (32+ characters)
- [ ] CORS origins properly configured
- [ ] File upload limits appropriate
- [ ] Rate limiting configured
- [ ] SSL certificate installed (HTTPS)
- [ ] Domain name configured

### Security Hardening

- [ ] Helmet security headers enabled
- [ ] Content Security Policy configured
- [ ] Database credentials secured
- [ ] Environment-specific configurations
- [ ] Security scanning completed
- [ ] Dependencies updated and audited

### Performance Optimization

- [ ] Caching configured (Redis/MongoDB)
- [ ] Static assets compressed
- [ ] Database indexes created
- [ ] Connection pooling configured
- [ ] Performance monitoring enabled

### Monitoring Setup

- [ ] Health check endpoint accessible
- [ ] Log aggregation configured
- [ ] Error tracking implemented
- [ ] Performance metrics collection
- [ ] Alert notifications configured

## 📊 Monitoring & Maintenance

### Health Monitoring

1. **Application Health:**
   ```bash
   curl https://yourdomain.com/health
   ```

2. **Database Monitoring:**
   ```bash
   # Check connection status
   docker-compose exec mongodb mongo --eval "db.stats()"

   # Monitor slow queries
   docker-compose exec mongodb mongo --eval "db.setProfilingLevel(1)"
   ```

3. **Performance Monitoring:**
   ```bash
   # Check application metrics (development only)
   curl http://localhost:3000/metrics
   ```

### Log Management

1. **Application Logs:**
   ```bash
   # View real-time logs
   docker-compose logs -f app

   # Export logs for analysis
   docker-compose logs app > app-logs.txt
   ```

2. **System Logs:**
   ```bash
   # Check system resource usage
   docker stats

   # Monitor disk usage
   df -h
   ```

### Backup Strategy

1. **Database Backups:**
   ```bash
   # Create MongoDB backup
   docker-compose exec mongodb mongodump --out /data/backup

   # Copy backup to host
   docker cp mongodb:/data/backup ./backup
   ```

2. **Automated Backups:**
   ```bash
   # Using cron job
   crontab -e
   # Add: 0 2 * * * /path/to/backup-script.sh
   ```

## 🔧 Troubleshooting

### Common Deployment Issues

**Port Conflicts:**
```bash
# Check port usage
netstat -tulpn | grep :3000

# Kill process using port
sudo kill -9 $(lsof -ti:3000)
```

**Memory Issues:**
```bash
# Check memory usage
docker stats

# Increase container memory
docker update --memory 2g container-name
```

**Database Connection Issues:**
```bash
# Test MongoDB connection
docker-compose exec app node -e "require('./db').connectDB().then(() => console.log('DB OK')).catch(console.error)"

# Check MongoDB logs
docker-compose logs mongodb
```

**File Permission Issues:**
```bash
# Fix upload directory permissions
sudo chmod -R 755 public/uploads/
sudo chown -R node:node public/uploads/
```

### Performance Issues

**High CPU Usage:**
```bash
# Identify resource-intensive processes
top -p $(pgrep node)

# Enable Node.js profiling
node --prof server.js
```

**Slow Database Queries:**
```bash
# Enable MongoDB profiler
docker-compose exec mongodb mongo --eval "db.setProfilingLevel(2)"

# View slow queries
docker-compose exec mongodb mongo --eval "db.system.profile.find({millis:{$gt:100}}).sort({millis:-1}).limit(10)"
```

**Memory Leaks:**
```bash
# Monitor memory usage over time
node -e "setInterval(() => console.log(process.memoryUsage()), 5000)"
```

### Security Issues

**Failed Authentication:**
```bash
# Check authentication logs
docker-compose logs app | grep -i "auth\|login"

# Verify session configuration
docker-compose exec app node -e "console.log(require('./config').SESSION_SECRET ? 'Secret OK' : 'Secret Missing')"
```

**Suspicious Activity:**
```bash
# Monitor failed requests
docker-compose logs app | grep -E "40[0-9]|50[0-9]"

# Check rate limiting logs
docker-compose logs app | grep -i "rate.limit\|too.many"
```

## 📞 Support & Resources

### Getting Help

1. **Check Documentation:**
   - [API Documentation](API_DOCUMENTATION.md)
   - [Development Standards](DEVELOPMENT_STANDARDS.md)
   - [Performance Optimizations](PERFORMANCE_OPTIMIZATIONS.md)

2. **Community Support:**
   - GitHub Issues: [Report bugs](../../issues)
   - GitHub Discussions: [Ask questions](../../discussions)

3. **Professional Support:**
   - Email: support@connected.edu
   - Slack: [#connected-support](https://connected.slack.com)

### Additional Resources

- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/donts-of-writing-production-ready-nodejs/)
- [MongoDB Production Checklist](https://docs.mongodb.com/manual/administration/production-checklist/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)

---

**ConnectED** - Production-ready deployment made simple.