# 🚀 SecureTrail - Quick Reference

## Start the Application

### Terminal 1 - Backend:
```bash
cd Backend
python main.py
```
**Runs on:** http://localhost:8000

### Terminal 2 - Frontend:
```bash
cd Frontend
npm run dev
```
**Runs on:** http://localhost:3001 (or 3000)

---

## 🎯 What You Can Do Now

### ✅ ZIP File Upload (Works Immediately)
1. Open http://localhost:3001
2. Click "Upload ZIP File"
3. Select a .zip file (max 100MB)
4. See "Extracted Successfully" notification
5. Click "Start Security Scan"

### 🔑 GitHub Upload (Needs OAuth Setup)
1. Setup GitHub OAuth (see SETUP.md)
2. Click "Connect GitHub"
3. Login with GitHub/Google
4. Browse and select repository
5. Choose branch
6. Click "Start Security Scan"

---

## 📝 Required OAuth Configuration

**Before GitHub login works:**

1. Create GitHub OAuth App: https://github.com/settings/developers
   - Callback: `http://localhost:8000/api/auth/github/callback`
   
2. Add to `Backend/.env`:
   ```
   GITHUB_CLIENT_ID=your_id_here
   GITHUB_CLIENT_SECRET=your_secret_here
   ```

3. Restart backend server

---

## 📋 Features Implemented

✅ Two upload methods (GitHub & ZIP)
✅ OAuth login modal
✅ Repository selector with search
✅ File validation (.zip only)
✅ Upload progress tracking
✅ "Extracted Successfully" notification
✅ Branch selection
✅ Toast notifications
✅ Error handling
✅ CORS configured
✅ Security validations

---

## 🔍 API Documentation

Once backend is running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## 📁 Key Files

### Backend:
- `main.py` - FastAPI app
- `Routes/auth.py` - OAuth endpoints
- `Routes/upload.py` - ZIP upload
- `.env` - Configuration

### Frontend:
- `src/App.jsx` - Main app
- `src/components/RepositoryUpload.jsx` - Upload UI
- `src/components/LoginModal.jsx` - Login dialog
- `src/services/api.js` - API client

---

## 🐛 Quick Fixes

**Port already in use:**
- Frontend will auto-pick next port (3001, 3002, etc.)
- Update `Backend/.env` CORS_ORIGINS to match

**OAuth errors:**
- Check `.env` has correct credentials
- Verify callback URL matches exactly
- Restart backend after changes

**Upload fails:**
- Check file is .zip format
- Ensure file < 100MB
- Verify backend is running

---

## 📖 Documentation Files

- **SETUP.md** - Complete setup instructions
- **IMPLEMENTATION.md** - Full feature documentation
- **Backend/README.md** - Backend API details
- **Frontend/README.md** - Frontend details

---

## 🎉 You're Ready!

The repository upload system is fully functional. Just configure OAuth to enable GitHub integration, or start using ZIP uploads right away!

**Next:** Implement security scanning logic in the backend to analyze the uploaded code.
