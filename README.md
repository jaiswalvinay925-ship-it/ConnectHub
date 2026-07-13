# Rubhi — Social Media Platform

A full-stack Instagram-style social media platform built with Express.js, PostgreSQL, and Vanilla JS.

---

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (SPA)
- **Auth:** JWT (JSON Web Tokens)
- **File Uploads:** Multer

---

## Prerequisites

- Node.js v18+
- PostgreSQL 14+
- npm

---

## Setup Instructions

### 1. Create the PostgreSQL database

```bash
psql -U postgres
CREATE DATABASE rubhi;
\q
```

### 2. Run the schema

```bash
psql -U postgres -d rubhi -f database/schema.sql
```

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Configure environment variables

Edit `backend/.env` with your database credentials:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rubhi
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=change_this_in_production
SESSION_SECRET=change_this_in_production
```

### 5. Seed the admin account

```bash
cd database
node seed.js
```



### 6. Start the server

```bash
cd backend
npm start
# or for development with auto-reload:
npm run dev
```

### 7. Open in browser

```
http://localhost:3000
```

---

## Login Flow

- Visit `/login`
- Admin credentials → redirected to `/admin`
- Regular user credentials → redirected to `/` (home feed)

---

## Admin Portal

Access at: `http://localhost:3000/admin`

Features:
- Dashboard with platform statistics
- User management (ban, unban, verify, delete, change role)
- Post moderation (hide, restore, delete)
- Comment moderation
- Story moderation
- Message moderation
- Verification request review (approve/reject)
- Report management
- Platform settings (toggle features, upload limits)

---

## Directory Structure

```
rubhi/
├── backend/
│   ├── config/db.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── routes/
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── follow.js
│   │   ├── messages.js
│   │   ├── notifications.js
│   │   ├── posts.js
│   │   ├── reports.js
│   │   ├── stories.js
│   │   ├── users.js
│   │   └── verification.js
│   ├── uploads/
│   ├── .env
│   ├── package.json
│   └── server.js
├── database/
│   ├── schema.sql
│   └── seed.js
└── frontend/
    ├── css/
    │   ├── admin.css
    │   ├── auth.css
    │   ├── components.css
    │   ├── global.css
    │   ├── layout.css
    │   └── variables.css
    ├── js/
    │   ├── api.js
    │   ├── auth.js
    │   ├── router.js
    │   ├── utils.js
    │   └── pages/
    │       ├── admin.js
    │       ├── create-post.js
    │       ├── home.js
    │       ├── login.js
    │       ├── messages.js
    │       ├── notifications.js
    │       ├── post-card.js
    │       ├── profile.js
    │       ├── register.js
    │       ├── search.js
    │       └── story.js
    └── index.html
```

---

## API Endpoints

| Group         | Method | Route                              |
|---------------|--------|------------------------------------|
| Auth          | POST   | /api/register                      |
| Auth          | POST   | /api/login                         |
| Auth          | POST   | /api/logout                        |
| Auth          | GET    | /api/me                            |
| Users         | GET    | /api/users/:username               |
| Users         | PUT    | /api/users/profile                 |
| Users         | GET    | /api/users/search?q=               |
| Follow        | POST   | /api/follow/:id                    |
| Follow        | DELETE | /api/follow/:id                    |
| Follow        | GET    | /api/follow/requests/pending       |
| Posts         | GET    | /api/posts                         |
| Posts         | POST   | /api/posts                         |
| Posts         | DELETE | /api/posts/:id                     |
| Likes         | POST   | /api/posts/:id/like                |
| Likes         | DELETE | /api/posts/:id/like                |
| Comments      | GET    | /api/posts/:id/comments            |
| Comments      | POST   | /api/posts/:id/comments            |
| Stories       | GET    | /api/stories                       |
| Stories       | POST   | /api/stories                       |
| Messages      | GET    | /api/messages                      |
| Messages      | POST   | /api/messages                      |
| Notifications | GET    | /api/notifications                 |
| Admin         | GET    | /api/admin/dashboard               |
| Admin         | GET    | /api/admin/users                   |
| Admin         | PUT    | /api/admin/users/:id/ban           |
| Admin         | PUT    | /api/admin/users/:id/verify        |

---

## Security Features

- Bcrypt password hashing (12 rounds)
- JWT authentication on all protected routes
- Helmet.js security headers
- Rate limiting (200 req/15min general, 20 req/15min auth)
- CORS protection
- XSS-safe output escaping
- SQL injection protection via parameterized queries
- File type validation on all uploads
- Admin role-based access control

---

## Notes

- Uploaded files are stored in `backend/uploads/`
- Stories expire automatically after 24 hours (checked server-side)
- The frontend is a single-page application served from Express
- In production, use HTTPS, set strong JWT/session secrets, and consider cloud storage for uploads
