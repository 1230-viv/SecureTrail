# 🚀 SecureTrail - Quick Setup Guide

## ✅ Prerequisites Completed

- ✅ PostgreSQL running in Docker
- ✅ Python dependencies installed (conda environment: `securetrail`)
- ✅ Frontend dependencies installed (npm)

## 🎯 How to Run the Project

### Option 1: Using Helper Scripts (Easiest)

#### **Terminal 1 - Start Backend:**
```bash
cd /home/parth219/Downloads/SecureTrail
chmod +x start-backend.sh
./start-backend.sh
```

#### **Terminal 2 - Start Frontend:**
```bash
cd /home/parth219/Downloads/SecureTrail
chmod +x start-frontend.sh
./start-frontend.sh
```

---

### Option 2: Manual Start

#### **Terminal 1 - Backend:**
```bash
cd /home/parth219/Downloads/SecureTrail/Backend

# Activate conda environment
eval "$(~/miniconda3/bin/conda shell.bash hook)"
conda activate securetrail

# Start backend
python main.py
```

#### **Terminal 2 - Frontend:**
```bash
cd /home/parth219/Downloads/SecureTrail/Frontend
npm run dev
```

---

## 🌐 Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/api/docs

---

## 🔧 Managing PostgreSQL Database

### Stop Database:
```bash
docker stop securetrail-postgres
```

### Start Database (if stopped):
```bash
docker start securetrail-postgres
```

### View Database Logs:
```bash
docker logs securetrail-postgres
```

### Access Database Shell:
```bash
docker exec -it securetrail-postgres psql -U securetrail -d securetrail
```

---

## 🛑 Stop the Project

- Press `Ctrl+C` in each terminal to stop the servers
- Optionally stop PostgreSQL: `docker stop securetrail-postgres`

---

## 📝 Important Notes

1. **First Run:** The backend will automatically create database tables on first startup
2. **AI Features:** Currently disabled (`AI_ENABLED=false` in `.env`). To enable:
   - Add your AWS credentials to `Backend/.env`
   - Set `AI_ENABLED=true`
3. **OAuth:** GitHub OAuth is configured. You can login to access repository scanning features

---

## 🐛 Troubleshooting

### Backend won't start:
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check conda environment
conda env list

# Reinstall dependencies
conda activate securetrail
pip install -r Backend/requirements.txt
```

### Frontend won't start:
```bash
# Reinstall dependencies
cd Frontend
npm install
```

### Database connection errors:
```bash
# Restart PostgreSQL
docker restart securetrail-postgres
```

---

## 🎓 Next Steps

1. Open http://localhost:5173 in your browser
2. Click "Sign in with GitHub" to authenticate
3. Upload a ZIP file or select a GitHub repository to scan
4. View detailed vulnerability analysis with AI explanations (if enabled)

**Enjoy using SecureTrail! 🛡️**
