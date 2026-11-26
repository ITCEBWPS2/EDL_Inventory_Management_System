# Deployment Guide — EDL Inventory Management System (EDL IMS)

This guide documents how to build and run the complete EDL IMS application (React single-page application + Express REST API) on a single port for production deployment (e.g., on a Windows Server machine).

---

## 1. Prerequisites

- **Node.js**: v18 or higher (LTS recommended)
- **MongoDB**: v5.0 or higher running locally or accessible via network URI

---

## 2. Build the Frontend Client

Before running the unified server, compile the React frontend into static production assets:

```bash
npm --prefix client run build
```

This generates optimized production files in `client/dist/`, including `index.html`, `assets/`, and image assets.

---

## 3. Environment Variables Configuration

Create a `.env` file in the `server/` directory (refer to `server/.env.example`).

### Required Environment Variable Names (Names only — provide secure values):
- `PORT` — Port number for the unified server (default: `5000`)
- `NODE_ENV` — Set to `production`
- `MONGODB_URI` — Connection string to MongoDB database
- `JWT_SECRET` — Strong, cryptographically secure secret for JWT token signing
- `CLIENT_URL` — Comma-separated list of allowed CORS origins (e.g. your production domain/IP)
- `SERVE_CLIENT` — Flag controlling frontend static serving (`true` or `false`, default: `true`)
- `REQUIRE_RECEIVED_SENDER` — Set `true` if sender name is mandatory in received transactions
- `ATTACHMENT_MAX_KB` — Max upload size in KB for attachments (e.g. `800`)
- `TRUST_PROXY` — Reverse proxy trust configuration (`false`, `true`, hop count, or proxy IPs)

### `SERVE_CLIENT` Flag Details:
- **`SERVE_CLIENT=true`** (default): Express automatically serves `client/dist/` on `http://localhost:<PORT>/` with asset caching and React SPA fallback routing. The whole system runs on a single port.
- **`SERVE_CLIENT=false`**: Express runs in API-only mode (useful if hosting the client on an external web server like Nginx/IIS or during Vite dev server development). Requests to non-API routes will return the standard 404 JSON response.

---

## 4. Run the Production Server

Start the unified server with `NODE_ENV=production`:

```bash
# Windows PowerShell
$env:NODE_ENV="production"; node server/src/server.js

# Windows Command Prompt (cmd)
set NODE_ENV=production && node server/src/server.js

# Linux / macOS
NODE_ENV=production node server/src/server.js
```

The unified application is now live at:
- **Website / SPA**: `http://localhost:5000/` (or your configured `PORT`)
- **API Endpoints**: `http://localhost:5000/api/...`
- **Health Check**: `http://localhost:5000/api/health`

---

## 5. Running as a Windows Service (Optional)

For unattended 24/7 background operation on Windows Server:

1. Install **NSSM** (Non-Sucking Service Manager) or **PM2**.
2. With PM2:
   ```bash
   npm install -g pm2
   pm2 start server/src/server.js --name "edl-ims" --env production
   pm2 save
   pm2 startup
   ```
3. Ensure inbound traffic on port `5000` (or your chosen `PORT`) is permitted in **Windows Defender Firewall**.
