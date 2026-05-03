# AfyaFlow — Complete Setup Guide

> Follow every step in order. Skipping steps will cause startup failures.

---

## Prerequisites — Install These First

| Tool | Minimum Version | Download Link |
|------|----------------|---------------|
| **Java JDK** | 17+ | https://adoptium.net |
| **Maven** | 3.9+ (bundled via `mvnw`) | included in repo |
| **Node.js** | 18+ | https://nodejs.org |
| **MySQL Server** | 8.0+ | https://dev.mysql.com/downloads/mysql/ |
| **Git** | any | https://git-scm.com |

> **Verify installations** by running these in a terminal:
> ```bash
> java -version
> node -v
> npm -v
> mysql --version
> ```

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/HOODBORN098/AfyaflowFinal.git
cd AfyaflowFinal
```

---

## Step 2 — Set Up the MySQL Database

### 2a. Log in to MySQL
```bash
mysql -u root -p
# Enter your MySQL root password when prompted
```

### 2b. Create the database
```sql
CREATE DATABASE afyaflow;
EXIT;
```

### 2c. Update the database credentials in the backend config

Open `AfyaFlow-Backend/src/main/resources/application.properties` and update:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/afyaflow?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=YOUR_MYSQL_PASSWORD_HERE
```

> The tables are created **automatically** by Hibernate when you first run the backend.  
> You do **not** need to run any SQL scripts.

---

## Step 3 — Run the Backend (Spring Boot)

```bash
cd AfyaFlow-Backend

# On Windows:
.\mvnw.cmd spring-boot:run

# On Mac / Linux:
./mvnw spring-boot:run
```

**Wait until you see this line in the terminal:**
```
Started AfyaFlowApplication in X.XXX seconds
```

The backend runs on **http://localhost:8080**

> **If Maven is not found**, make sure Java 17+ is installed and `JAVA_HOME` is set correctly.

---

## Step 4 — Run the Staff Dashboard (afyaflow-react)

This is the main dashboard used by **Doctors, Receptionists, and Admins**.

Open a **new terminal**:

```bash
cd afyaflow-react
npm install
npm run dev
```

The staff dashboard runs on **http://localhost:5174**

---

## Step 5 — Run the Patient Online Portal (AfyaFlow-Frontend)

This is the patient-facing website for **online appointment booking**.

Open another **new terminal**:

```bash
cd AfyaFlow-Frontend
npm install
npm run dev
```

The patient portal runs on **http://localhost:5173**

---

## Step 6 — First-Time Account Setup

### Create the Admin Account
1. Go to **http://localhost:5173** (patient portal)
2. Click **Register**
3. The **very first account** registered is automatically given the **Admin** role
4. Log in to the staff dashboard at **http://localhost:5174** with those credentials

### Create Doctor & Receptionist Accounts
After logging in as Admin, use the staff dashboard to create additional accounts with the correct roles.

> **Doctor accounts**: The system automatically creates a Doctor profile linked to the registered email, so the doctor can immediately receive patients.

---

## Step 7 — Verify Everything is Working

| URL | What it should show |
|-----|---------------------|
| `http://localhost:8080/api/patients` | JSON response (may be empty array `[]`) |
| `http://localhost:5174` | Staff Login page |
| `http://localhost:5173` | Patient portal homepage |

---

## Architecture Overview

```
AfyaflowFinal/
├── AfyaFlow-Backend/       ← Spring Boot REST API (port 8080)
│   └── src/main/java/com/afyaflow/
│       ├── controller/     ← API endpoints
│       ├── service/        ← Business logic
│       ├── model/          ← JPA entities (auto-creates DB tables)
│       ├── repository/     ← Database queries
│       └── security/       ← JWT authentication
│
├── afyaflow-react/         ← Staff Dashboard — React + Vite (port 5174)
│   └── src/
│       ├── pages/          ← DoctorDashboard, ReceptionistDashboard, AdminDashboard
│       ├── context/        ← Auth, Data, Search state
│       └── components/     ← Reusable UI components
│
└── AfyaFlow-Frontend/      ← Patient Portal — React + Vite (port 5173)
    └── src/
        └── app/pages/      ← Register, Login, PatientDashboard, Booking
```

---

## Key System Rules

| Rule | Detail |
|------|--------|
| **First registered user** | Automatically becomes Admin |
| **Doctor queue** | Doctors only see patients assigned to them |
| **Admin & Receptionist queue** | Can see all patients across all departments |
| **Online booking → queue** | Patient status is set to `queued` immediately upon confirmed booking |
| **Reschedule** | Patients can reschedule via `PUT /api/appointments/{id}` |

---

## Common Issues & Fixes

### ❌ Backend fails to start — "Access denied for user 'root'"
> Your MySQL password in `application.properties` doesn't match. Update `spring.datasource.password`.

### ❌ Backend fails to start — "Unknown database 'afyaflow'"
> You haven't created the database yet. Run `CREATE DATABASE afyaflow;` in MySQL.

### ❌ Frontend shows "Network Error" or empty queue
> The backend is not running. Start it first (Step 3) before the frontends.

### ❌ `npm install` fails with permission errors (Windows)
> Run your terminal as **Administrator**, or use `npm install --legacy-peer-deps`.

### ❌ `mvnw` is not recognized (Windows)
> Make sure Java 17+ is installed and the `JAVA_HOME` environment variable points to your JDK directory.

### ❌ Port 8080 already in use
> Another process is using port 8080. Kill it with `netstat -ano | findstr :8080` then `taskkill /PID <id> /F`.

---

## Environment at a Glance

| Component | URL | Technology |
|-----------|-----|------------|
| Backend API | http://localhost:8080 | Spring Boot 3, Java 17, MySQL |
| Staff Dashboard | http://localhost:5174 | React 18, Vite, TypeScript |
| Patient Portal | http://localhost:5173 | React 18, Vite, TypeScript |

---

*AfyaFlow — Hospital Management System*
