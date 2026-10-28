import { RouterProvider } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { TrackedItemsProvider } from './context/TrackedItemsContext'
import { WebSocketProvider } from './context/WebSocketContext'
import { router as defaultRouter } from './routes/router'

interface AppProps {
  router?: any
}

export default function App({ router = defaultRouter }: AppProps) {
  return (
    <WebSocketProvider>
      <AppProvider>
        <TrackedItemsProvider>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </TrackedItemsProvider>
      </AppProvider>
    </WebSocketProvider>
  )
}
