# SecureTrail Frontend

React + Vite + Tailwind CSS application for SecureTrail - AI Security Mentor.

## 🚀 Getting Started

### Installation

```bash
cd Frontend
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 📦 Tech Stack

- **React 18** - UI Library
- **Vite** - Build Tool & Dev Server
- **Tailwind CSS** - Utility-first CSS Framework
- **Lucide React** - Icon Library

## 🏗️ Project Structure

```
Frontend/
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx          # Left navigation sidebar
│   │   ├── RepositoryUpload.jsx # File upload and branch selection
│   │   ├── RiskSummary.jsx      # Vulnerability statistics
│   │   └── RecentScans.jsx      # Recent scan history
│   ├── App.jsx                   # Main application component
│   ├── main.jsx                  # Application entry point
│   └── index.css                 # Global styles with Tailwind
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🎨 Features

- ✅ Responsive sidebar navigation
- ✅ Repository upload interface (ZIP/Git)
- ✅ Branch selection dropdown
- ✅ Risk summary dashboard
- ✅ Recent scans with risk levels
- ✅ Clean, modern UI with Tailwind CSS
- ✅ Icon integration with Lucide React

## 🔜 Next Steps

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Connect to FastAPI backend (to be implemented)
4. Add routing for multiple pages
5. Implement file upload functionality
6. Connect to API endpoints

## 🎯 Components Overview

### Sidebar
- Dashboard (active)
- Scan History
- Learning Insights
- Settings

### Repository Upload
- File upload area
- Branch selection
- Start scan button

### Risk Summary
- Total vulnerabilities count
- High risk count

### Recent Scans
- Scan history with timestamps
- Risk level indicators (High/Medium/Low)
