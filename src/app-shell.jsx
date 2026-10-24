
import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth, firebaseConfigMissing } from './firebase-config'
import { useApp } from './app-context'
import { ChangePw, Login, Setup } from './authentication'
import { Dashboard, Announcements, Audit } from './dashboard-page'
import { Org, Employees } from './organization-page'
import { Attendance, Leave } from './attendance-page'
import { Payroll, Payslips } from './payroll-page'
import { AiAssistant } from './ai-assistant'

const NAV = {
  admin: [['/', 'Dashboard'], ['/org', 'Organization'], ['/employees', 'Employees'], ['/attendance', 'Attendance'], ['/leave', 'Leave'], ['/payroll', 'Payroll'], ['/payslips', 'Payslips'], ['/news', 'Announcements'], ['/audit', 'Audit log']],
  hr: [['/', 'Dashboard'], ['/employees', 'Employees'], ['/attendance', 'Attendance'], ['/leave', 'Leave'], ['/payroll', 'Payroll'], ['/payslips', 'Payslips'], ['/news', 'Announcements']],
  manager: [['/', 'Dashboard'], ['/employees', 'Employees'], ['/attendance', 'Attendance'], ['/leave', 'Leave'], ['/payroll', 'Payroll'], ['/payslips', 'Payslips'], ['/news', 'Announcements']],
  employee: [['/', 'Dashboard'], ['/attendance', 'Attendance'], ['/leave', 'Leave'], ['/payslips', 'Payslips'], ['/news', 'Announcements']],
}
export default function App() {
  const { loading, user, settings } = useApp()

  if (firebaseConfigMissing) {
    return <div className="center card"><h1>Firebase setup required</h1>
      <p>The app is running, but the Firebase environment variables are missing.</p>
      <p>Add your project values to <strong>.env</strong> with:</p>
      <pre style={{ textAlign: 'left', whiteSpace: 'pre-wrap' }}>{`VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=...
VITE_FB_PROJECT_ID=...
VITE_FB_APP_ID=...`}</pre>
      <p>Then restart the app with <strong>npm run dev -- --host 0.0.0.0</strong>.</p>
    </div>
  }

  if (loading) return <p style={{ padding: 30 }}>Loading…</p>
  if (!user) return <Login />
  if (user.mustChangePassword) return <ChangePw uid={user.uid} />
  if (!user.active) return <p style={{ padding: 30 }}>This login is deactivated. Ask your Admin.</p>
  return <div className="shell"><nav><h2>HCM Lite</h2><small>{settings?.name} · {user.role}</small>
    {NAV[user.role].map(([to, t]) => <NavLink key={to} to={to} end={to === '/'}>{t}</NavLink>)}
    <button className="ghost" onClick={() => signOut(auth)}>Logout</button></nav>
    <main>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {user.role === 'admin' && <Route path="/org" element={<Org />} />}
        {user.role !== 'employee' && <Route path="/employees" element={<Employees />} />}
        {user.role !== 'employee' && <Route path="/payroll" element={<Payroll />} />}
        {user.role === 'admin' && <Route path="/audit" element={<Audit />} />}
        <Route path="/attendance" element={<Attendance />} /><Route path="/leave" element={<Leave />} />
        <Route path="/payslips" element={<Payslips />} /><Route path="/news" element={<Announcements />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <AiAssistant />
    </main></div>
}
