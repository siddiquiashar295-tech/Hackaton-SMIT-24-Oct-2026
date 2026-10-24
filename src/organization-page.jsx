import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, createLogin, db } from './firebase-config'
import { useApp } from './app-context'
import { F, ListAdd, Table, Tag } from './shared-ui'
import { audit, useCol } from './business-logic'

export function Org() {
  const { settings: s, user } = useApp(), [f, setF] = useState(s), [m, setM] = useState('')
  const set = k => e => setF({ ...f, [k]: e.target.type === 'number' ? +e.target.value : e.target.value })
  const save = async e => { e.preventDefault(); await setDoc(doc(db, 'settings', 'company'), f); audit('update', 'settings', s, f); setM('Saved. Reload to apply.') }
  return <><h1>Organization</h1>
    <form className="card" onSubmit={save}><F l="Company" value={f.name} onChange={set('name')} /><F l="Office start" type="time" value={f.start} onChange={set('start')} />
      <F l="Grace (min)" type="number" value={f.grace} onChange={set('grace')} /><F l="Half day under (h)" type="number" value={f.half} onChange={set('half')} />
      <F l="Office latitude" type="number" step="any" value={f.lat ?? ''} onChange={set('lat')} /><F l="Office longitude" type="number" step="any" value={f.lng ?? ''} onChange={set('lng')} />
      <F l="Radius (m)" type="number" value={f.radius} onChange={set('radius')} /><button>Save settings</button>{m && <span className="ok">{m}</span>}</form>
    <ListAdd col="departments" title="Departments" fields={[{ k: 'name', l: 'Name' }]} show={i => i.name} />
    <ListAdd col="designations" title="Designations" fields={[{ k: 'name', l: 'Name' }]} show={i => i.name} />
    <ListAdd col="leaveTypes" title="Leave types" fields={[{ k: 'name', l: 'Name' }, { k: 'quota', l: 'Yearly quota (blank = unlimited)', type: 'number', optional: true }]} show={i => `${i.name} — ${i.quota ?? 'unlimited'}`} />
    <ListAdd col="holidays" title="Holidays" fields={[{ k: 'date', l: 'Date', type: 'date' }, { k: 'name', l: 'Name' }]} show={i => `${i.date} — ${i.name}`} />
    <HrLogins /></>
}

function HrLogins() {
  const users = useCol('users'), [f, setF] = useState({}), [err, setErr] = useState('')
  const add = async e => {
    e.preventDefault(); setErr('')
    try {
      const role = f.role || 'hr'
      const uid = await createLogin(f.email, f.pw)
      const d = { email: f.email, name: f.name, role, active: true, mustChangePassword: true }
      await setDoc(doc(db, 'users', uid), d)
      if (role === 'employee') {
        await setDoc(doc(db, 'employees', uid), {
          code: '',
          name: f.name,
          email: f.email,
          phone: '',
          address: '',
          deptId: '',
          deptName: 'General',
          designation: 'Employee',
          joinDate: new Date().toISOString().slice(0, 10),
          basic: 0,
          status: 'active',
        }, { merge: true })
      }
      audit('create', `user:${role}`, null, d); setF({ role: 'hr' })
    } catch (x) { setErr(x.message) }
  }

  const updateRole = async (userId, role) => {
    const target = users.find(u => u.id === userId)
    if (!target || !role || role === 'admin') return
    await updateDoc(doc(db, 'users', userId), { role })
    audit('update', 'userRole', { role: target.role }, { role })
  }

  return <div className="card"><h3 style={{ marginTop: 0 }}>User access</h3>
    <form onSubmit={add}><F l="Name" required value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} /><F l="Email" type="email" required value={f.email || ''} onChange={e => setF({ ...f, email: e.target.value })} />
      <label>Role<select value={f.role || 'hr'} onChange={e => setF({ ...f, role: e.target.value })}><option value="hr">HR</option><option value="manager">Manager</option><option value="employee">Employee</option></select></label>
      <F l="Temporary password" minLength={6} required value={f.pw || ''} onChange={e => setF({ ...f, pw: e.target.value })} /><button>Create user login</button></form>{err && <div className="msg">{err}</div>}
    <Table head={['Name', 'Email', 'Role', 'Status', '']} rows={users.map(u => [u.name, u.email,
      u.role === 'admin'
        ? 'Admin'
        : <select value={u.role || 'employee'} onChange={e => updateRole(u.id, e.target.value)}><option value="hr">HR</option><option value="manager">Manager</option><option value="employee">Employee</option></select>,
      <Tag s={u.active ? 'approved' : 'rejected'} />,
      u.role === 'admin' ? '' : <span className="row"><button className="ghost" onClick={() => { updateDoc(doc(db, 'users', u.id), { active: !u.active }); audit('update', 'user', { active: u.active }, { active: !u.active }) }}>{u.active ? 'Deactivate' : 'Activate'}</button>
        <button className="ghost" onClick={() => sendPasswordResetEmail(auth, u.email)}>Reset password</button></span>])} /></div>
}

export function Employees() {
  const { user } = useApp(), emps = useCol('employees'), depts = useCol('departments'), desigs = useCol('designations')
  const [f, setF] = useState({}), [err, setErr] = useState(''), [q, setQ] = useState(''), [dep, setDep] = useState('')
  const set = k => e => setF({ ...f, [k]: e.target.value })

  const updateDesignation = async (employeeId, designation) => {
    if (!designation) return
    const employee = emps.find(x => x.id === employeeId)
    if (!employee) return
    await updateDoc(doc(db, 'employees', employeeId), { designation })
    await updateDoc(doc(db, 'users', employeeId), { designation })
    audit('update', 'employeeDesignation', { designation: employee.designation }, { designation })
  }

  const add = async e => {
    e.preventDefault(); setErr('')
    if (+f.basic <= 0) return setErr('Salary must be above 0.')
    if (emps.some(x => x.code === f.code || x.email === f.email)) return setErr('Employee code and email must be unique.')
    if (!f.designation || !f.designation.trim()) return setErr('Enter a designation before registering the employee.')
    const d = depts.find(x => x.id === f.deptId)
    try {
      const uid = await createLogin(f.email, f.pw)
      await setDoc(doc(db, 'users', uid), { email: f.email, name: f.name, role: 'employee', active: true, mustChangePassword: true, designation: f.designation.trim() })
      const emp = { code: f.code, name: f.name, email: f.email, phone: f.phone || '', address: '', deptId: d.id, deptName: d.name, designation: f.designation.trim(), joinDate: f.joinDate, basic: +f.basic, status: 'active' }
      await setDoc(doc(db, 'employees', uid), emp); audit('create', 'employee', null, emp); setF({})
    } catch (x) { setErr(x.message) }
  }
  const shown = emps.filter(x => (!dep || x.deptId === dep) && (x.name + x.code + x.email).toLowerCase().includes(q.toLowerCase()))
  return <><h1>Employees</h1>
    {(user.role === 'hr' || user.role === 'manager' || user.role === 'admin') && <form className="card" onSubmit={add}>
      <F l="Code" required value={f.code || ''} onChange={set('code')} /><F l="Name" required value={f.name || ''} onChange={set('name')} /><F l="Email" type="email" required value={f.email || ''} onChange={set('email')} />
      <F l="Phone" value={f.phone || ''} onChange={set('phone')} />
      <label>Department<select required value={f.deptId || ''} onChange={set('deptId')}><option value="">Select</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <F l="Designation" required value={f.designation || ''} onChange={set('designation')} />
      <F l="Joining date" type="date" required value={f.joinDate || ''} onChange={set('joinDate')} /><F l="Basic salary" type="number" required value={f.basic || ''} onChange={set('basic')} />
      <F l="Temporary password" minLength={6} required value={f.pw || ''} onChange={set('pw')} /><button>Register employee</button>
      {err && <div className="msg" style={{ width: '100%' }}>{err}</div>}{!depts.length && <div className="msg" style={{ width: '100%' }}>Add a department first before creating employee records.</div>}</form>}
    <div className="row" style={{ marginBottom: 12 }}><F l="Search" value={q} onChange={e => setQ(e.target.value)} />
      <label>Department<select value={dep} onChange={e => setDep(e.target.value)}><option value="">All</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
    <Table head={['Code', 'Name', 'Department', 'Designation', 'Joined', 'Basic']} empty="No employees yet. HR registers the first one." rows={shown.map(x => [x.code, x.name, x.deptName,
      user.role === 'admin' || user.role === 'manager'
        ? <input value={x.designation || ''} onChange={e => updateDesignation(x.id, e.target.value)} />
        : x.designation,
      x.joinDate, x.basic])} /></>
}
