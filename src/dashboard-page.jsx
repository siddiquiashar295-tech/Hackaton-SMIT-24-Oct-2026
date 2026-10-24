import { useState } from 'react'
import { addDoc, collection, serverTimestamp, where } from 'firebase/firestore'
import { db } from './firebase-config'
import { useApp } from './app-context'
import { F, Table } from './shared-ui'
import { audit, hours, isLate, sortNew, useCol, ymd } from './business-logic'

const Kpi = ({ n, t }) => <div className="kpi"><b>{n}</b>{t}</div>

export function Dashboard() {
  const { user } = useApp()
  return <><h1>Dashboard</h1>
    <div className="card" style={{ marginTop: '-6px', marginBottom: '18px' }}>
      <strong>Welcome, {user?.name || 'User'}</strong>
    </div>
    {user.role === 'employee' ? <Mine /> : <Staff />}<News limit={3} /></>
}

function Staff() {
  const today = ymd(new Date())
  const emps = useCol('employees'), att = useCol('attendance'), lv = useCol('leaves'), fx = useCol('attendanceFixes')
  const active = emps.filter(e => e.status !== 'exited')
  const todays = att.filter(a => a.date === today)
  const onLeave = lv.filter(l => l.status === 'approved' && l.start <= today && l.end >= today)
  const byDept = {}; active.forEach(e => byDept[e.deptName] = (byDept[e.deptName] || 0) + 1)
  return <><div className="kpis">
    <Kpi n={active.length} t="Headcount" /><Kpi n={todays.length} t="Checked in today" /><Kpi n={onLeave.length} t="On leave today" />
    <Kpi n={todays.filter(isLate).length} t="Late today" /><Kpi n={lv.filter(l => l.status === 'pending').length} t="Leave awaiting approval" />
    <Kpi n={fx.filter(f => f.status === 'pending').length} t="Corrections awaiting approval" /></div>
    <h3>Headcount by department</h3><Table head={['Department', 'People']} rows={Object.entries(byDept)} empty="No employees registered yet." /></>
}

function Mine() {
  const { user } = useApp(), uid = user.uid, today = new Date()
  const att = useCol('attendance', [where('empId', '==', uid)], uid), lv = useCol('leaves', [where('empId', '==', uid)], uid)
  const types = useCol('leaveTypes'), slips = useCol('payslips', [where('empId', '==', uid)], uid), notes = useCol('notifications', [where('toUid', '==', uid)], uid)
  const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7)); const ms = ymd(mon)
  const month = ymd(today).slice(0, 7), year = String(today.getFullYear())
  const last = [...slips].sort((a, b) => b.month.localeCompare(a.month))[0]
  return <><div className="kpis">
    <Kpi n={att.filter(a => a.date >= ms).reduce((s, a) => s + hours(a), 0).toFixed(1) + ' / 40'} t="Hours this week" />
    <Kpi n={att.filter(a => a.date.startsWith(month) && isLate(a)).length} t="Late this month" />
    <Kpi n={last ? last.net : '—'} t={last ? `Last payslip (${last.month})` : 'No payslip yet'} /></div>
    <h3>Leave left this year</h3><Table head={['Type', 'Left']} rows={types.map(t => {
      const used = lv.filter(l => l.typeId === t.id && ['approved', 'pending'].includes(l.status) && l.start.startsWith(year)).reduce((s, l) => s + l.days, 0)
      return [t.name, t.quota == null ? 'Unlimited' : t.quota - used] })} />
    <h3>Notifications</h3><Table head={['Message']} rows={[...notes].sort(sortNew).slice(0, 5).map(n => [n.text])} empty="No notifications." /></>
}

function News({ limit }) {
  const items = [...useCol('announcements')].sort(sortNew).slice(0, limit)
  return <><h3>Announcements</h3>{items.length ? items.map(a => <div className="card" key={a.id}><b>{a.title}</b><p style={{ margin: '4px 0 0' }}>{a.body}</p></div>) : <p style={{ opacity: .6 }}>No announcements.</p>}</>
}

export function Announcements() {
  const { user } = useApp(), [f, setF] = useState({ title: '', body: '' })
  const post = async e => { e.preventDefault(); await addDoc(collection(db, 'announcements'), { ...f, by: user.name, at: serverTimestamp() }); audit('create', 'announcement', null, f); setF({ title: '', body: '' }) }
  return <><h1>Announcements</h1>
    {user.role !== 'employee' && <form className="card" onSubmit={post}><F l="Title" required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <F l="Message" required value={f.body} onChange={e => setF({ ...f, body: e.target.value })} style={{ minWidth: 320 }} /><button>Post</button></form>}
    <News limit={50} /></>
}

export function Audit() {
  const logs = [...useCol('auditLogs')].sort(sortNew).slice(0, 200)
  return <><h1>Audit log</h1><Table head={['When', 'Who', 'Action', 'Entity', 'After']} empty="No actions logged yet."
    rows={logs.map(l => [l.at ? new Date(l.at.seconds * 1000).toLocaleString() : '…', l.actorEmail, l.action, l.entity, <small>{(l.after || '').slice(0, 80)}</small>])} /></>
}
