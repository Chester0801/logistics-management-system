# Construction Transportation Management System (CTMS)

## 🚛 Overview
A professional, full-stack web application for managing truck entries at construction sites. Digitizes the complete truck entry process with a modern UI, real-time dashboard, advanced reporting, and export capabilities.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```

Then open your browser at: **http://localhost:3000**

---

## 🔐 Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ctms.com | admin123 |
| Supervisor | supervisor@ctms.com | supervisor123 |

---

## ✨ Features

### 📊 Dashboard
- Total trucks (today / week / month / all-time)
- Daily activity bar chart (last 30 days)
- Material distribution doughnut chart
- Top transporters ranked list
- Recent entries table

### 🚛 Truck Entry Management
- Add, Edit, Delete, View entries
- Fields: Transport, Driver, Truck No, Material, Weight, Date, Time In/Out, Remarks
- Smart autocomplete for transport names
- Paginated table (20/50/100 per page)

### 🔍 Advanced Search & Filter
- Global search bar
- Filter by: Transport, Driver, Truck Number, Material Type, Date, Date Range
- Real-time filter application

### 📄 Reports
- **Daily Report**: All entries for a selected day + material/transport summaries
- **Weekly Report**: Week-wise breakdown + charts
- **Monthly Report**: Full month analysis + day-wise breakdown table

### 📥 Export
- **CSV**: Filtered or complete data export
- **Excel (.xlsx)**: Formatted spreadsheet with headers

### 👥 User Management (Admin Only)
- View all users
- Add new admins or supervisors
- Delete users (with protection against self-deletion)

### 🎨 UI Features
- 🌙 Dark / ☀️ Light mode toggle
- Fully responsive (Mobile, Tablet, Desktop)
- Animated stat counters
- Toast notifications
- Confirmation dialogs for destructive actions

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3 (Vanilla), JavaScript (ES6+) |
| Charts | Chart.js v4 |
| Backend | Node.js + Express.js |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcryptjs |
| Export | SheetJS (xlsx) |

---

## 📁 Project Structure

```
transport/
├── server.js              # Express backend + all API routes
├── package.json           # Dependencies
├── database/
│   └── ctms.db            # SQLite database (auto-created)
└── public/
    ├── index.html         # Login page
    ├── dashboard.html     # Dashboard
    ├── entries.html       # Truck entries (CRUD)
    ├── reports.html       # Reports module
    ├── users.html         # User management (Admin)
    ├── css/
    │   └── style.css      # Global styles + dark mode
    └── js/
        ├── utils.js       # Shared utilities
        ├── dashboard.js   # Dashboard logic
        ├── entries.js     # Entries CRUD logic
        └── reports.js     # Reports logic
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Authenticate user |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/dashboard/recent` | Recent 10 entries |
| GET | `/api/dashboard/daily-chart` | 30-day chart data |
| GET | `/api/dashboard/material-chart` | Material distribution |
| GET | `/api/dashboard/transport-chart` | Top transporters |
| GET | `/api/entries` | List entries (with filters + pagination) |
| POST | `/api/entries` | Create new entry |
| GET | `/api/entries/:id` | Get single entry |
| PUT | `/api/entries/:id` | Update entry |
| DELETE | `/api/entries/:id` | Delete entry |
| GET | `/api/reports/daily` | Daily report |
| GET | `/api/reports/weekly` | Weekly report |
| GET | `/api/reports/monthly` | Monthly report |
| GET | `/api/export/csv` | Export as CSV |
| GET | `/api/export/excel` | Export as Excel |
| GET | `/api/users` | List users (Admin) |
| POST | `/api/users` | Create user (Admin) |
| DELETE | `/api/users/:id` | Delete user (Admin) |

---

## 🔒 Security
- JWT tokens with 24h expiry
- bcrypt password hashing
- Role-based access control (Admin vs Supervisor)
- Token validated on every API call
