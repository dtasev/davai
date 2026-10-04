import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export function LoginRoute() {
  const { userProfile } = useApp()

  if (userProfile) {
    return <Navigate to="/" replace />
  }

  return null
}
