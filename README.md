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
# Comma-separated list of allowed frontend origins:
CLIENT_URL=http://localhost:5173,http://localhost:5174
JWT_SECRET=your_jwt_secret_key
MONGODB_URI=mongodb://127.0.0.1:27017/edl_ims
# Maximum size in KB for voucher and transaction attachments (default: 800)
ATTACHMENT_MAX_KB=800
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
| **Super Admin** | `superadmin` (or `sadmin@edl.lk`) | `sadmin123` | Global (All Units) | System-wide oversight, user/unit administration, full category/type management |
| **Local Admin** | `localadmin` (or `ladmin@edl.lk`) | `ladmin123` | WPS-II Regional Scope | Administers users & units, manage categories & item types in region |
| **Unit Head** | `unithead` (or `headit@edl.lk`) | `head123` | CSC Homagama | Full inventory items management in unit; category & type management restricted |
| **Employee (RW)** | `employeerw` (or `emp.rw@edl.lk`) | `emprw123` | CSC Homagama | Read & Write (Add records, received vouchers) |
| **Employee (RO)** | `employeero` (or `emp.ro@edl.lk`) | `empro123` | CSC Homagama | Read Only (View stock & reports; writes blocked 403) |
| **Employee (None)**| `employeenone` (or `emp.none@edl.lk`)| `empnone123` | Call Center & DCC | No Permission (Blocked 403 on all inventory) |

### 🏷️ Item Categories & Types Governance:
- **Add / Rename / Delete Categories & Sub-Categories:** Strictly restricted to **Super Admin** and **Local Admin** (scoped to assigned units). Built-in categories and subcategories require Super Admin clearance to delete.
- **Add Custom Item Types:** Only **Super Admin** and **Local Admin** can add new item types (via the `+ New type` inline link, `+ Add new type...` in the type dropdowns, or category cards).
- **Unit Heads & Employees:** Unit Heads can view categories and create/edit inventory items within their assigned unit, but **cannot** add, edit, or delete categories, sub-categories, or custom item types. Unauthorized API requests return HTTP `403 Forbidden` with the message: `"Only Super Admin and Local Admin can manage item categories and types."` All write controls are hidden from their UI.

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

---

## 🛡️ Audit Logging & Compliance (Tamper-Resistant)

The system records an append-only, tamper-resistant trail of all user authentication, inventory mutations, transactions, verifications, user administration, and print/export events.

### Immutability & Security Architecture:
1. **Append-Only Storage:** All audit records are written to MongoDB's `audit_logs` collection. The API router (`server/src/routes/auditLogs.routes.js`) exposes only `GET` query endpoints and an internal log sink (`POST /api/audit-logs/log`). **No `PUT`, `PATCH`, or `DELETE` endpoints exist** anywhere in the system for audit logs.
2. **Server-Enforced Unit Scoping:**
   - **Super Admin:** Global view across all organizational units and system-wide operations (`unit_id: null`).
   - **Local Admin:** Scoped strictly to their assigned unit and descendant units (computed via organizational unit hierarchy).
   - **Unit Head:** Scoped strictly to their own assigned unit. Requests specifying another unit are rejected with `403 Forbidden`.
   - **Employees:** Blocked with `403 Forbidden` on the API and denied in UI routing.
3. **Data Protection & Masking:** Sensitive fields (passwords, tokens, credentials) are automatically scrubbed and redacted by `auditLogger.js` before persistence.
4. **Retention Policy (`AUDIT_LOG_RETENTION_DAYS`):**
   - Configurable in `server/.env`:
     ```env
     # 0 = retain indefinitely (default); or specify days (e.g. 365, 730)
     AUDIT_LOG_RETENTION_DAYS=0
     ```
   - If set to a positive number, a MongoDB TTL index automatically purges records older than the specified retention window. When 0 or omitted, records are retained permanently.

### 🌐 Client IP Detection & Privacy Architecture:
1. **Accurate Client IP Resolution:**
   - Client IP addresses are resolved through `server/src/utils/clientIp.js` (`getClientIpDetails(req)`).
   - Automatically normalizes IPv6-mapped IPv4 addresses (e.g. `::ffff:192.168.1.25` &rarr; `192.168.1.25`), removes ports and zone identifiers, and takes the first client IP in comma-separated proxy lists.
   - When requests originate from localhost loopback (`::1`, `127.0.0.1`), the system resolves the host's actual LAN IPv4 address (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`) via active network interfaces and records `ip_source: "local-resolved"` with the original loopback value preserved in `ip_raw`.
2. **Reverse Proxy Configuration (`TRUST_PROXY`):**
   - Configurable in `server/.env`:
     ```env
     # false (default in dev), true, hop count (e.g. 1), or list of proxy IPs
     TRUST_PROXY=false
     ```
   - When `TRUST_PROXY` is disabled, `X-Forwarded-For` and `X-Real-IP` headers are strictly ignored to prevent client IP spoofing; only direct TCP socket addresses are trusted.
   - When enabled, Express safely evaluates the client IP based on trusted hop configurations.
3. **Data Privacy & Access Control:**
   - IP addresses and client telemetry are classified as personal data.
   - Audit log records are strictly restricted to Super Admin, Local Admin, and Unit Head within their authorized organizational unit scope. All employee roles receive `403 Forbidden` and cannot inspect client IPs or user telemetry.

### 💻 Testing from Another Computer on the Same Wi-Fi / LAN:
1. Ensure the server and client are accessible across the local network:
   ```bash
   # Run Vite client with --host to expose to the local network:
   npm --prefix client run dev -- --host
   ```
2. Find the server computer's LAN IP (e.g. `192.168.1.50` or `10.238.5.39`).
3. On another device connected to the same Wi-Fi/LAN, open `http://<SERVER_LAN_IP>:5173` in a web browser.
4. Log in as an administrator (e.g. `superadmin` / `sadmin123`).
5. Navigate to **Settings > Audit Log**:
   - The new login and action records will display the second device's actual LAN IP address with `Source: direct` (or `via proxy` if behind a reverse proxy).
   - Local actions taken on the host machine will display the host's LAN IP with `Source: local machine`.

---

## Unified Button System & Design Tokens

The application follows a standardized button sizing and variant architecture implemented via `client/src/components/common/Button.jsx` and CSS variables in `client/src/index.css`:

### 1. Size Scale
| Size | Height | Horiz. Padding | Font Size | Font Weight | Border Radius | Icon Size | Usage |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Regular** (default) | `32px` | `11px` | `12.5px` | `600` | `8px` | `14px` | Page actions (`AddButton`, `ExportButton`), modal footers (`Save`, `Cancel`, `Confirm`), Form submits |
| **Small** | `24px` | `7px` | `11.5px` | `500` | `6px` | `12px` | Table row actions (`EditButton`, `DeleteButton`, `ViewButton` with `min-w-[50px]`, `gap-1` / `4px` group spacing), filter dropdowns, pagination buttons |
| **Icon-only** | `24x24px` / `32x32px` | `0` | — | — | `6px` / `8px` | `12px` / `14px` | Modal close 'X', row icon buttons, chevrons |

### 2. Button Variants
- **Primary**: Brand maroon gradient (`#5a1230` &rarr; `#7a1a3c`), white text, subtle maroon shadow. Used for primary page actions (`+ Add`, `+ Start New Survey`, `Submit`, `Confirm`).
- **Secondary / Outline**: White background, subtle border (`#e6dcd7`), hover warm tint (`#fbf6f1`). Used for exports (`Export CSV`, `Print Report`), cancel actions, and secondary toolbar buttons.
- **Danger Soft**: Soft red background (`#fdf1f1`), light red border (`#f3cfcf`), dark red text (`#b42318`). Used for table row `Delete`.
- **Danger Solid**: Solid red background (`#b42318`), white text. Used for destructive confirmation modals (`Confirm Delete`, `Discard Draft`).
- **Ghost**: Transparent background, text hover tint. Used for subtle dismiss and inline triggers.

---

## 📊 Unified Report & Table Architecture

Reports and data tables follow a consolidated card layout:
1. **Single Card Container**: Report tabs, search toolbars, inline summary chips, data tables, and pagination footers are consolidated into ONE main white card (`border-[rgba(123,28,62,0.28)] shadow-card rounded-2xl`), eliminating floating "boxy" clutter over background imagery.
2. **Inline Summary Chips**: Key statistics (e.g. `Total Items`, `Active Categories`) are presented as compact inline chips (~32px height) directly inside the toolbar rather than oversized floating cards.
3. **Shared TablePagination (`TablePagination.jsx`)**: Standardized bottom footer bar with "Showing X-Y of Z items", "Rows per page" selection (25 / 50 / 100 / 200), numbered page pager with maroon active state and ellipsis, Prev/Next buttons, and "Show all" toggle, featuring sticky bottom positioning and smooth auto-scroll.

---

## 📥 CSV Export Encoding & Excel Compatibility

All CSV exports throughout EDL IMS (including Remaining Inventory Balance, Current Inventory Report, Transaction History, Verification Audit Report, Verification History, Issued/Destroyed, Organizational Units, Staff Directory, and Audit Logs) utilize a unified export helper:
- **UTF-8 with BOM**: CSV files are UTF-8 with BOM so they open correctly in Excel without garbling multi-byte or non-ASCII characters such as en dashes (`–`), Sinhala text (`වගුව`), Tamil text, accented letters, and engineering/mathematical symbols (`²`, `°`, `µ`, `×`).
- **RFC 4180 Standards**: Fields containing commas, double quotes, or line breaks are wrapped in double quotes with internal quotes doubled (`""`), and rows use standard CRLF (`\r\n`) line endings.
- **Formula Injection Security**: Text cells starting with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped by prefixing a single quote (`'`), while genuine numeric values are preserved unaltered.



