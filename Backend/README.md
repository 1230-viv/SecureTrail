# SecureTrail Backend

FastAPI backend for SecureTrail - AI Security Mentor.

## 🚀 Getting Started

### Prerequisites

- Python 3.8 or higher
- pip

### Installation

1. Create a virtual environment:
```bash
cd Backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your OAuth credentials
```

### Running the Server

```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 📁 Project Structure

```
Backend/
├── Controller/
│   └── models.py           # Pydantic models
├── Routes/
│   ├── auth.py            # Authentication endpoints
│   ├── repository.py      # GitHub repository endpoints
│   └── upload.py          # File upload endpoints
├── uploads/               # Uploaded files directory
├── main.py               # FastAPI application
├── requirements.txt      # Python dependencies
├── .env.example         # Environment variables template
└── .gitignore
```

## 🔑 API Endpoints

### Authentication
- `GET /api/auth/github/login` - Get GitHub OAuth URL
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/auth/google/login` - Get Google OAuth URL
- `POST /api/auth/logout` - Logout user

### Repository
- `GET /api/repository/list` - List user's GitHub repositories
- `POST /api/repository/clone` - Clone a repository for analysis

### Upload
- `POST /api/upload/zip` - Upload and extract ZIP file
- `DELETE /api/upload/cleanup/{upload_id}` - Cleanup uploaded files

## ⚙️ Configuration

### GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL to: `http://localhost:8000/api/auth/github/callback`
4. Copy Client ID and Client Secret to `.env` file

### Google OAuth Setup

1. Go to Google Cloud Console
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:8000/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env` file

## 🔒 Security Features

- CORS configured for frontend origin
- File type validation (ZIP only)
- File size limits (100MB max)
- Path traversal protection in ZIP extraction
- JWT token authentication (ready for implementation)

## 📝 Environment Variables

See `.env.example` for all required environment variables.

## 🛠️ Development

### Adding New Routes

1. Create route file in `Routes/` directory
2. Define router and endpoints
3. Import and include router in `main.py`

### Adding New Models

Add Pydantic models to `Controller/models.py`
