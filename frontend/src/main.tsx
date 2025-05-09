import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ChatProvider } from './contexts/ChatContext'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

// Create router with simplified configuration since we handle verification directly in App
const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
    },
    {
      path: '*',
      element: <App />,
    }
  ]
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChatProvider>
      <RouterProvider router={router} />
    </ChatProvider>
  </React.StrictMode>,
)
