import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updatePassword } from 'firebase/auth'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, createLogin, db } from './firebase-config'
import { F } from './shared-ui'

const DEFAULT_ADMIN_EMAIL = 'siddiquiashar295@gmail.com'
const DEFAULT_ADMIN_PASSWORD = '123456789'
const DEFAULT_ADMIN_NAME = 'Admin'

async function ensureDefaultAdmin() {
  if (!auth || !db) return false

  try {
    const uid = await createLogin(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD)
    const ref = doc(db, 'users', uid)
    await setDoc(ref, {
      email: DEFAULT_ADMIN_EMAIL,
      name: DEFAULT_ADMIN_NAME,
      role: 'admin',
      active: true,
      mustChangePassword: false,
      designation: 'Admin',
    }, { merge: true })

    await setDoc(doc(db, 'settings', 'company'), {
      name: 'My Company',
      start: '09:00',
      grace: 15,
      half: 5,
      weekend: [0, 6],
      lat: null,
      lng: null,
      radius: 150,
    }, { merge: true })

    for (const [id, name, quota] of [['annual', 'Annual', 14], ['sick', 'Sick', 8], ['casual', 'Casual', 10], ['unpaid', 'Unpaid', null]]) {
      await setDoc(doc(db, 'leaveTypes', id), { name, quota }, { merge: true })
    }

    await setDoc(doc(db, 'meta', 'init'), { done: true }, { merge: true })
    return true
  } catch (x) {
    if (x.code === 'auth/email-already-in-use') {
      return false
    }
    if (x.code === 'auth/network-request-failed') {
      return false
    }
    throw x
  }
}

export function Setup() {
  const [f, setF] = useState({}), [err, setErr] = useState(''), set = k => e => setF({ ...f, [k]: e.target.value })
  const go = async e => {
    e.preventDefault(); setErr('')
    try {
      const c = await createUserWithEmailAndPassword(auth, f.email, f.pw)
      await setDoc(doc(db, 'users', c.user.uid), { email: f.email, name: f.name, role: 'admin', active: true, mustChangePassword: false, designation: 'Admin' })
      await setDoc(doc(db, 'settings', 'company'), { name: f.company, start: '09:00', grace: 15, half: 5, weekend: [0, 6], lat: null, lng: null, radius: 150 })
      for (const [id, name, quota] of [['annual', 'Annual', 14], ['sick', 'Sick', 8], ['casual', 'Casual', 10], ['unpaid', 'Unpaid', null]])
        await setDoc(doc(db, 'leaveTypes', id), { name, quota })
      await setDoc(doc(db, 'meta', 'init'), { done: true })
      location.reload()
    } catch (x) { setErr(x.message) }
  }
  return <div className="center card"><h1>Set up HCM Lite</h1><p>Create your company and the Admin account.</p>
    <form onSubmit={go}><F l="Company name" required onChange={set('company')} /><F l="Admin name" required onChange={set('name')} />
      <F l="Admin email" type="email" required onChange={set('email')} /><F l="Password (min 6)" type="password" minLength={6} required onChange={set('pw')} />
      <button>Create company</button>{err && <div className="msg">{err}</div>}</form></div>
}

export function Login() {
  const [f, setF] = useState({}), [err, setErr] = useState(''), [msg, setMsg] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    let live = true
    const initAdmin = async () => {
      try {
        await ensureDefaultAdmin()
      } catch (x) {
        if (live) {
          setErr(x.message || 'Admin setup failed.')
        }
      }
    }
    initAdmin()
    return () => { live = false }
  }, [])

  const go = async e => {
    e.preventDefault(); setErr(''); setMsg('')
    try {
      await signInWithEmailAndPassword(auth, f.email, f.pw)
      nav('/')
    } catch (x) {
      const msg = x.code === 'auth/invalid-login-credentials' || x.code === 'auth/user-not-found' || x.code === 'auth/wrong-password'
        ? 'Incorrect email or password. Use the admin account details or reset the password.'
        : x.message
      setErr(msg)
    }
  }

  const reset = async () => {
    setErr(''); setMsg('')
    if (!f.email) {
      setErr('Enter your email first, then click Forgot password.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, f.email)
      setMsg('Password reset email sent. Check your inbox.')
    } catch (x) {
      setErr(x.message)
    }
  }

  return <div className="center card">
    <h1>Sign in</h1>
    <form onSubmit={go}><F l="Email" type="email" required value={f.email || ''} onChange={e => setF({ ...f, email: e.target.value })} />
      <F l="Password" type="password" required value={f.pw || ''} onChange={e => setF({ ...f, pw: e.target.value })} />
      <button type="submit">Sign in</button>{err && <div className="msg">{err}</div>}{msg && <div className="ok">{msg}</div>}</form>
    <div style={{ marginTop: 12 }}><button type="button" className="ghost" onClick={reset}>Forgot password</button></div>
  </div>
}

export function ChangePw({ uid }) {
  const [pw, setPw] = useState(''), [confirmPw, setConfirmPw] = useState(''), [err, setErr] = useState(''), [msg, setMsg] = useState('')

  const go = async e => {
    e.preventDefault(); setErr(''); setMsg('')
    if (pw.length < 6) return setErr('Password must be at least 6 characters long.')
    if (pw !== confirmPw) return setErr('Passwords do not match.')
    try {
      await updatePassword(auth.currentUser, pw)
      await updateDoc(doc(db, 'users', uid), { mustChangePassword: false })
      setMsg('Password updated successfully.')
      setPw(''); setConfirmPw('')
    } catch (x) {
      setErr(x.message)
    }
  }

  return <div className="center card"><h1>Create new password</h1><p>Set a secure password for your account.</p>
    <form onSubmit={go}>
      <F l="New password (min 6)" type="password" minLength={6} value={pw} required onChange={e => setPw(e.target.value)} />
      <F l="Confirm password" type="password" minLength={6} value={confirmPw} required onChange={e => setConfirmPw(e.target.value)} />
      <button>Save password</button>{err && <div className="msg">{err}</div>}{msg && <div className="ok">{msg}</div>}
    </form></div>
}
