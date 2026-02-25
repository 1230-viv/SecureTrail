# SecureTrail - Complete Setup Guide

## 📋 Quick Start

### Backend Setup

1. **Navigate to Backend directory:**
```bash
cd Backend
```

2. **Create and activate virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables:**
```bash
cp .env.example .env
# Edit .env file and add your OAuth credentials (see below)
```

5. **Run the backend server:**
```bash
python main.py
```

Backend will run on `http://localhost:8000`

---

### Frontend Setup

1. **Navigate to Frontend directory:**
```bash
cd Frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment (optional):**
```bash
cp .env.example .env
# Edit if you need to change API URL
```

4. **Run the development server:**
```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

---

## 🔑 OAuth Configuration

### GitHub OAuth

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name:** SecureTrail Local Dev
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:8000/api/auth/github/callback`
4. Click "Register application"
5. Copy **Client ID** and **Client Secret**
6. Add to `Backend/.env`:
```
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

### Google OAuth (Optional)

1. Go to: https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Configure OAuth consent screen if needed
6. Select "Web application"
7. Add authorized redirect URI: `http://localhost:8000/api/auth/google/callback`
8. Copy **Client ID** and **Client Secret**
9. Add to `Backend/.env`:
```
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

---

## 🎯 Features Implemented

### Backend (FastAPI)
✅ GitHub OAuth authentication
✅ Google OAuth authentication (ready)
✅ GitHub repository listing API
✅ ZIP file upload with validation
✅ Automatic ZIP extraction
✅ CORS configuration
✅ Path traversal protection
✅ File size limits (100MB)

### Frontend (React + Vite + Tailwind)
✅ Two upload methods: GitHub & ZIP
✅ Login modal with GitHub/Google options
✅ GitHub repository selector with search
✅ ZIP file upload with drag-and-drop area
✅ File validation (ZIP only)
✅ Upload progress indicator
✅ Toast notifications for all actions
✅ "Extracted Successfully" notification
✅ Repository selection display
✅ Branch selection for GitHub repos
✅ Responsive design

---

## 🚀 How to Use

### Method 1: GitHub Repository

1. Click "Connect GitHub" button
2. Login with GitHub or Google
3. Browse and search your repositories
4. Select a repository
5. Choose a branch (default is main)
6. Click "Start Security Scan"

### Method 2: ZIP Upload

1. Click "Upload ZIP File" button
2. Select a .zip file (max 100MB)
3. Wait for upload and extraction
4. See "Extracted Successfully" notification
5. Click "Start Security Scan"

---

## 📡 API Endpoints

### Health Check
```bash
curl http://localhost:8000/health
```

### List Repositories (requires auth token)
```bash
curl http://localhost:8000/api/repository/list \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN"
```

### Upload ZIP
```bash
curl -X POST http://localhost:8000/api/upload/zip \
  -F "file=@path/to/your/repo.zip"
```

---

## 🔧 Troubleshooting

### Backend Issues

**Port 8000 already in use:**
```bash
# Change PORT in Backend/.env or use different port:
uvicorn main:app --reload --port 8001
```

**OAuth callback errors:**
- Ensure callback URLs match exactly in OAuth app settings
- Check that backend is running on correct port

### Frontend Issues

**API connection errors:**
- Ensure backend is running
- Check VITE_API_URL in Frontend/.env
- Verify CORS_ORIGINS in Backend/.env includes frontend URL

**Dependencies issues:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📁 Project Structure

```
SecureTrail/
├── Backend/
│   ├── Controller/
│   │   └── models.py
│   ├── Routes/
│   │   ├── auth.py
│   │   ├── repository.py
│   │   └── upload.py
│   ├── uploads/
│   ├── main.py
│   ├── requirements.txt
│   └── .env
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── RepositoryUpload.jsx
│   │   │   ├── RepositorySelector.jsx
│   │   │   ├── LoginModal.jsx
│   │   │   ├── RiskSummary.jsx
│   │   │   └── RecentScans.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
└── README.md (this file)
```

---

## 🔜 Next Steps

1. ✅ OAuth setup complete
2. ✅ File upload complete
3. ⏳ Implement security scanning logic
4. ⏳ Vulnerability detection
5. ⏳ AI integration for insights
6. ⏳ Learning recommendations

---

## 📝 Notes

- GitHub token is stored in localStorage
- Uploaded files are stored in `Backend/uploads/`
- ZIP extraction creates unique directory per upload
- All ZIP files are validated before extraction
