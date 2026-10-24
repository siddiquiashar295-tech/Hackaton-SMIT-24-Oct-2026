# HCM Lite (React + Vite + Firebase)

## Run
1. Firebase console: create project, enable **Authentication → Email/Password** and **Firestore**.
2. Add a Web app, copy keys into `.env` (see `.env.example`).
3. Deploy rules: `npm i -g firebase-tools && firebase login && firebase deploy --only firestore:rules`
4. `npm install && npm run dev`
5. First visit shows **first-run setup** (company + Admin account). Admin adds departments, designations, holidays, HR logins. HR registers employees (temp password, forced change on first sign-in).

## Deploy
`npm run build && firebase deploy --only hosting`

## Access control
All role/data-scope checks live in `firestore.rules` (server-side). Employees can only read rows with their own `empId`; payroll finalize is Admin-only; audit log is append-only and Admin-readable.

## Done
Setup, login/roles, org setup, HR logins, employees, web check-in/out, corrections, leave (overlap + balance + working days), approval inbox, payroll draft/finalize/lock, payslip PDF, KPIs dashboards, announcements, notifications, audit log.

## Not done yet
AI assistant (M8), CSV import/export, charts/trends, camera attendance.
