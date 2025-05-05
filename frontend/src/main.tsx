import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ChatProvider } from './contexts/ChatContext'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import EmailVerification from './components/EmailVerification'

// Create router with both future flags properly enabled for v6.30.0
const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
    },
    {
      path: '/verify-email/:token',
      element: <EmailVerification />,
    },
    {
      path: '*',
      element: <App />,
    }
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_startTransition: true
    },
  }
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChatProvider>
      <RouterProvider router={router} />
    </ChatProvider>
  </React.StrictMode>,
)
