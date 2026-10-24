import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, db, firebaseConfigMissing } from './firebase-config'
const C = createContext()
const ADMIN_EMAIL = 'siddiquiashar295@gmail.com'
export const useApp = () => useContext(C)
export function AppProvider({ children }) {
  const [st, setSt] = useState({ loading: true })
  useEffect(() => {
    if (firebaseConfigMissing) {
      setSt({ loading: false, setup: false })
      return
    }

    let un = () => {}
    const off = onAuthStateChanged(auth, async u => {
      un()
      try {
        const initSnap = await getDoc(doc(db, 'meta', 'init'))
        const setup = !initSnap.exists()
        if (!u) return setSt({ loading: false, setup })

        const fallbackUser = {
          uid: u.uid,
          email: u.email,
          name: u.displayName || u.email?.split('@')[0] || 'User',
          role: u.email === ADMIN_EMAIL ? 'admin' : 'employee',
          active: true,
          mustChangePassword: false,
          designation: u.email === ADMIN_EMAIL ? 'Admin' : 'Employee',
        }

        un = onSnapshot(doc(db, 'users', u.uid), async us => {
          try {
            if (!us.exists()) {
              if (u.email === ADMIN_EMAIL) {
                await setDoc(doc(db, 'users', u.uid), {
                  email: u.email,
                  name: u.displayName || 'Admin',
                  role: 'admin',
                  active: true,
                  mustChangePassword: false,
                  designation: 'Admin',
                }, { merge: true })
              }
              const s = await getDoc(doc(db, 'settings', 'company')).catch(() => null)
              return setSt({ loading: false, setup, user: u.email === ADMIN_EMAIL ? { ...fallbackUser, role: 'admin', designation: 'Admin' } : fallbackUser, settings: s?.exists() ? s.data() : { name: 'My Company' }, emp: null })
            }

            const profile = us.data()
            const safeName = profile.name || u.displayName || u.email?.split('@')[0] || 'User'
            const role = profile.role || (u.email === ADMIN_EMAIL ? 'admin' : 'employee')
            const [s, e] = await Promise.all([getDoc(doc(db, 'settings', 'company')), getDoc(doc(db, 'employees', u.uid))])

            if (role === 'employee' && !e.exists()) {
              await setDoc(doc(db, 'employees', u.uid), {
                code: '',
                name: safeName,
                email: u.email,
                phone: '',
                address: '',
                deptId: '',
                deptName: 'General',
                designation: profile.designation || 'Employee',
                joinDate: new Date().toISOString().slice(0, 10),
                basic: 0,
                status: 'active',
              }, { merge: true })
            }

            setSt({ loading: false, setup, user: { uid: u.uid, ...profile, name: safeName, role, designation: profile.designation || (role === 'admin' ? 'Admin' : 'Employee') }, settings: s.exists() ? s.data() : { name: 'My Company' }, emp: e.exists() ? { id: e.id, ...e.data() } : null })
          } catch {
            setSt({ loading: false, setup: false, user: fallbackUser, settings: { name: 'My Company' }, emp: null })
          }
        })
      } catch {
        setSt({ loading: false, setup: true })
      }
    })
    return () => { off(); un() }
  }, [])
  return <C.Provider value={st}>{children}</C.Provider>
}
