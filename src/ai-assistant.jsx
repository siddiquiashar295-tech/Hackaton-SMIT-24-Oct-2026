import { useMemo, useState } from 'react'
import { useApp } from './app-context'
import { useCol, ymd } from './business-logic'

function localAnswer(question, data, user) {
  const q = question.toLowerCase()
  const { employees, attendance, leaves, settings } = data

  if (q.includes('headcount') || q.includes('active employees') || q.includes('how many employees')) {
    const active = employees.filter(e => e.status !== 'exited').length
    return `There are ${active} active employees in the system.`
  }

  if (q.includes('late') || q.includes('late today')) {
    const today = ymd(new Date())
    const late = attendance.filter(a => a.date === today && a.checkIn && a.rules && a.checkIn.toDate() > new Date(`${today}T${a.rules.start}:00`)).length
    return `Today, ${late} employee${late === 1 ? '' : 's'} are marked late based on the office start time.`
  }

  if (q.includes('leave') && (q.includes('balance') || q.includes('left'))) {
    if (user.role !== 'employee') return 'Use the employee dashboard or ask about a specific employee record.'
    const myLeaves = leaves.filter(l => l.empId === user.uid && ['approved', 'pending'].includes(l.status))
    const total = myLeaves.reduce((sum, l) => sum + Number(l.days || 0), 0)
    return `You currently have ${total} approved or pending leave day(s) in the app. This is based on your leave requests and approved records.`
  }

  if (q.includes('summary') || q.includes('dashboard')) {
    const active = employees.filter(e => e.status !== 'exited').length
    const checkedIn = attendance.filter(a => a.date === ymd(new Date())).length
    const pending = leaves.filter(l => l.status === 'pending').length
    return `Summary: ${active} active employees, ${checkedIn} checked in today, and ${pending} leave requests awaiting approval.`
  }

  if (settings && (q.includes('office') || q.includes('grace') || q.includes('work')) && (q.includes('setting') || q.includes('policy'))) {
    return `Office start is ${settings.start}, grace is ${settings.grace} minutes, and the working day threshold is ${settings.half} hours.`
  }

  return 'I can answer from the live HCM Lite data. Try questions like: “How many active employees are there?”, “Who is late today?”, “What is my leave balance?”, or “Give me a dashboard summary.”'
}

async function askOpenRouter(question, data, user) {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) {
    return localAnswer(question, data, user)
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'HCM Lite Assistant',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an HR assistant for HCM Lite. Answer only from the JSON data provided by the app and be brief. If data is missing, say so clearly.',
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nLive data: ${JSON.stringify(data)}`,
        },
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) throw new Error('AI request failed')
  const payload = await response.json()
  return payload?.choices?.[0]?.message?.content || 'I could not produce an answer from the AI service.'
}

export function AiAssistant() {
  const { user } = useApp()
  const employees = useCol('employees')
  const attendance = useCol('attendance')
  const leaves = useCol('leaves')
  const payslips = useCol('payslips')
  const settings = useCol('settings')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! Ask me about headcount, attendance, leave, or payroll from the live HCM Lite data.' },
  ])

  const data = useMemo(() => ({
    employees,
    attendance,
    leaves,
    payslips,
    settings: settings[0] || {},
    today: ymd(new Date()),
  }), [employees, attendance, leaves, payslips, settings])

  const send = async e => {
    e.preventDefault()
    const q = input.trim()
    if (!q || busy) return

    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setBusy(true)

    try {
      const answer = await askOpenRouter(q, data, user)
      setMessages(prev => [...prev, { role: 'bot', text: answer }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: localAnswer(q, data, user) }])
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return <div className="assistant-shell">
    <div className="assistant-header">
      <h3 style={{ margin: 0 }}>AI Assistant</h3>
      <small style={{ opacity: 0.7 }}>Answers from live HR data</small>
    </div>

    <div className="assistant-messages">
      {messages.map((m, i) => (
        <div key={i} className={`chat-bubble ${m.role === 'user' ? 'user' : 'bot'}`}>
          {m.text}
        </div>
      ))}
    </div>

    <form className="assistant-form" onSubmit={send}>
      <input value={input} placeholder="Ask about attendance, payroll, leave, or headcount..." onChange={e => setInput(e.target.value)} />
      <button type="submit" disabled={busy}>{busy ? 'Thinking...' : 'Ask'}</button>
    </form>
  </div>
}
