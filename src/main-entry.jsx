import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app-shell'
import { AppProvider } from './app-context'
import './index.css'
createRoot(document.getElementById('root')).render(<BrowserRouter><AppProvider><App /></AppProvider></BrowserRouter>)
