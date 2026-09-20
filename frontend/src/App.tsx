import React from 'react'
import { RouterProvider } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { router as defaultRouter } from './routes/router'

interface AppProps {
  router?: any
}

export default function App({ router = defaultRouter }: AppProps) {
  return (
    <AppProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AppProvider>
  )
}
