# 🚀 ReliefHub Deployment Guide

This guide provides step-by-step instructions for deploying **ReliefHub: ReliefGrid Operations Console** to live cloud platforms.

Because ReliefHub is architected with a unified Express backend that serves both the **REST / Multi-Agent AI API** and the **built React SPA (`dist/`)**, you can deploy the complete project as a **single unified web service** with **zero CORS issues**.

---

## 🌟 Recommended Hosting Platforms Overview

| Platform | Best For | Cost | Setup Time | Difficulty |
|---|---|---|---|---|
| **Render.com** (Recommended) | Full-stack Node + React | Free tier available | 3 minutes | ⭐ Very Easy |
| **Railway.app** | Instant GitHub repo link | Free trial / \$5 credits | 2 minutes | ⭐ Very Easy |
| **Google Cloud Run / AWS ECS** | Scalable containerized workloads | Free tier / Pay-per-use | 10 minutes | ⭐⭐ Moderate |
| **Vercel + Render** (Split) | Static CDN frontend + Hosted API | Free | 5 minutes | ⭐⭐ Moderate |

---

## 🥇 Option 1: Render.com (Recommended — 1-Click Unified Service)

Render allows you to run both the frontend and backend on a single free URL (e.g. `https://reliefhub.onrender.com`).

### Steps:
1. Go to [Render.com](https://render.com) and log in with your GitHub account.
2. Click **New +** → **Web Service**.
3. Connect your repository (`Team-CodeCrafters`).
4. Configure the service settings:
   - **Name:** `reliefhub-operations`
   - **Region:** Frankfurt / Oregon / Singapore (choose closest)
   - **Branch:** `team_CodeCrafters`
   - **Root Directory:** `submission/team_CodeCrafters/ReliefHub`
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm install && npm run build
     ```
   - **Start Command:**
     ```bash
     npm start
     ```
   - **Instance Type:** `Free`
5. *(Optional)* Add Environment Variables in the **Environment** tab:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` *(Render sets this automatically)*
   - `GEMINI_API_KEY`: *(Optional, unlocks live LLM mode alongside deterministic engine)*
6. Click **Create Web Service**.
7. Once deployed, Render will provide a public HTTPS URL where ReliefHub is immediately live!

---

## 🥈 Option 2: Railway.app

1. Sign in to [Railway.app](https://railway.app/) using GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select the `Team-CodeCrafters` repo.
4. Go to **Settings** → **Root Directory** and set:
   ```
   submission/team_CodeCrafters/ReliefHub
   ```
5. Railway will automatically detect the `package.json` or `Dockerfile`.
6. Under **Variables**, add:
   - `PORT`: `3001`
   - `NODE_ENV`: `production`
7. Click **Deploy**. Railway will generate a live public domain (e.g., `*.up.railway.app`).

---

## 🐳 Option 3: Docker Deployment (Any Cloud / Local / VPS)

A multi-stage `Dockerfile` is included in the project directory.

### Build and Run Locally:
```bash
cd submission/team_CodeCrafters/ReliefHub

# 1. Build the container image
docker build -t reliefhub:latest .

# 2. Run the container
docker run -d -p 3001:3001 --name reliefhub-app reliefhub:latest

# 3. Access in browser
http://localhost:3001
```

### Deploy to Google Cloud Run / AWS App Runner / DigitalOcean:
1. Tag your image:
   ```bash
   docker tag reliefhub:latest <your-registry>/reliefhub:latest
   ```
2. Push to registry (Docker Hub, AWS ECR, or Google Artifact Registry):
   ```bash
   docker push <your-registry>/reliefhub:latest
   ```
3. Deploy as a container service exposing port `3001`.

---

## ⚡ Option 4: Split Deployment (Vercel Frontend + Render API)

If you prefer serving the frontend on Vercel's global Edge CDN:

### A. Deploy Backend on Render
1. Follow Option 1 above, but set Start Command to:
   ```bash
   npx tsx server/index.ts
   ```
2. Note your backend URL (e.g., `https://reliefhub-api.onrender.com`).

### B. Deploy Frontend on Vercel
1. Go to [Vercel](https://vercel.com) and import the repo.
2. Set **Root Directory** to `submission/team_CodeCrafters/ReliefHub`.
3. In **Build & Output Settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. In `vite.config.ts`, update the proxy or create a `vercel.json` rewrites file pointing `/api/:path*` to `https://reliefhub-api.onrender.com/api/:path*`.

---

## 🧪 Local Production Verification

To test the exact production build on your local machine before pushing to cloud:

```powershell
cd "c:\Users\EURO COMPUTERS\Desktop\hackathon project\Team-CodeCrafters\submission\team_CodeCrafters\ReliefHub"

# 1. Build production client
npm run build

# 2. Start unified production server
npm start
```

Open `http://localhost:3001` — you will see the full application running directly from the Express production bundle!
