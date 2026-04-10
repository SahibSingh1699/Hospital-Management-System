# 🏥 Hospital Management System (HMS)

A full-stack Hospital Management System built using:

* Node.js (Backend)
* Prisma ORM
* SQLite (can be switched to MySQL/PostgreSQL)
* HTML/CSS/JS (Frontend)

---

## 📁 Project Structure

```
hms/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── dev.db (ignored)
│
├── public/
│   ├── css/
│   ├── js/
│   └── index.html
│
├── server.js
├── package.json
├── .env (ignored)
└── .gitignore
```

---

## ⚙️ Prerequisites

Make sure you have installed:

* Node.js (>= 16)
* npm

---

## 🚀 Setup Instructions (After Cloning)

### 1. Clone the repository

```
git clone https://github.com/sankalp6115/Hospital-Management-System
cd hms
```

---

### 2. Install dependencies

```
npm install
```

---

### 3. Setup Environment Variables

Create a `.env` file in root:

```
DATABASE_URL="file:./prisma/dev.db"
PORT=3000
```

---

### 4. Setup Database

Run:

```
npx prisma migrate dev
```

👉 This will:

* Create database (`dev.db`)
* Apply schema
* Create tables

---

### 5. Generate Prisma Client

```
npx prisma generate
```

---

### 6. Start Server

```
npm run dev
```

or

```
node server.js
```

---

## 🌐 Access App

Open in browser:

```
http://localhost:3000
```

---

## 🔄 Useful Prisma Commands

```
npx prisma studio        # Open DB GUI
npx prisma migrate dev   # Apply migrations
npx prisma generate      # Generate client
```

---

## ⚠️ Important Notes

* `node_modules/` is ignored
* `.env` is ignored (create manually)
* `prisma/dev.db` is ignored (auto-created)
* `schema.prisma` and `migrations/` are required for setup

---

## 🧠 How It Works

* `schema.prisma` → defines database structure
* `migrations/` → recreate database on any system
* Prisma → handles database queries
* Node.js → backend API
* Frontend → interacts via API
