# EDL Inventory Management System (EDL IMS)
### Electricity Distribution Lanka (Pvt) Ltd

A centralized, role- and unit-restricted digital inventory management platform designed for Electricity Distribution Lanka (Pvt) Ltd. Replaces manual paper notebooks with an audited digital system for electrical distribution items, goods received/expended vouchers, remaining balances, annual verification (Board of Survey), and compliance reporting.

---

## 🏗️ Architecture & Technology Stack

- **Frontend:** React.js (Vite), React Router, Tailwind CSS, Lucide Icons, IBM Plex Mono & Inter typography.
- **Backend API:** Node.js + Express.js REST API with centralized business validation.
- **Database:** MongoDB (via Mongoose ODM) on the `edl_ims` database.
- **Dual-Layer Authorization:**
  1. **Express Middleware Chain:** `requireAuth` &rarr; `requireRole` &rarr; `requirePermission` &rarr; `requireUnitAccess`
  2. **Role & Unit Scoping:** Granular permissions per unit and role enforced at the API service layer.
- **File Storage:** Local disk storage (`server/uploads/vouchers`) with dedicated `/api/vouchers/file/:fileName` serving route.
- **Authentication:** App JWTs signed with `JWT_SECRET` and passwords securely hashed with bcrypt.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
# Install root, server, and client dependencies
npm run install:all
```

### 2. Configure MongoDB
Ensure MongoDB is running locally (e.g. `mongodb://127.0.0.1:27017/edl_ims`).
In `server/.env`:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret_key
MONGODB_URI=mongodb://127.0.0.1:27017/edl_ims
```

### 3. Seed & Import Data
```bash
# Seed initial hierarchy, staff profiles, categories, and inventory
npm --prefix server run seed

# (Optional) Import backup data from server/server_memory_backup.json
npm --prefix server run import:backup
```

### 4. Run Both Server & Client Concurrently
```bash
npm run dev
```
- **Client (UI):** [http://localhost:5173](http://localhost:5173)
- **Server (API):** [http://localhost:5000/api](http://localhost:5000/api)
- **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🔑 Pre-Configured Demo Accounts

For immediate evaluation, the login page features an **Instant Demo Role Switcher** card:

| Role | Username | Password | Unit Scope | Privileges |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` (or `sadmin@edl.lk`) | `sadmin123` | Global (All Units) | System-wide oversight, user/unit administration |
| **Local Admin** | `localadmin` (or `ladmin@edl.lk`) | `ladmin123` | WPS-II Regional Scope | Administers users & units within region |
| **Unit Head** | `unithead` (or `headit@edl.lk`) | `head123` | CSC Homagama | Full inventory management in assigned unit |
| **Employee (RW)** | `employeerw` (or `emp.rw@edl.lk`) | `emprw123` | CSC Homagama | Read & Write (Add records, received vouchers) |
| **Employee (RO)** | `employeero` (or `emp.ro@edl.lk`) | `empro123` | CSC Homagama | Read Only (View stock & reports; writes blocked 403) |
| **Employee (None)**| `employeenone` (or `emp.none@edl.lk`)| `empnone123` | Call Center & DCC | No Permission (Blocked 403 on all inventory) |

---

## 🧪 Automated Testing

### Backend Middleware & Authorization Tests:
```bash
npm --prefix server test
```
Tests:
- Missing/invalid JWT token rejection (401)
- Read-only employee mutation attempts (403)
- No-permission employee access blocks (403)
- Cross-unit access denial
- Super Admin global cross-unit clearance
- Dynamic remaining inventory balance reconciliation (`received - expended`)
- Multi-serial batch and sequence generator verification

---

## 💾 Backup & Disaster Recovery Strategy

1. **MongoDB Automated Backups:**
   - Scheduled automated dump via cron / mongodump:
     ```bash
     mongodump --uri="mongodb://127.0.0.1:27017/edl_ims" --gzip --archive="/backup/edl_ims_$(date +%Y%m%d).gz"
     ```
   - Restore command:
     ```bash
     mongorestore --uri="mongodb://127.0.0.1:27017/edl_ims" --gzip --archive="/backup/edl_ims_<date>.gz"
     ```
