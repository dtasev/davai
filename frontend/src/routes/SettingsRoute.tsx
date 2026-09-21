import { useApp } from '../context/AppContext'
import { SettingsView } from '../components/Settings/SettingsView'

export function SettingsRoute() {
  const {
    userProfile,
    apiKeys,
    loadingAuth,
    authError,
    handleRevokeKey,
    handleCreateKey
  } = useApp()

  return (
    <SettingsView
      userProfile={userProfile}
      apiKeys={apiKeys}
      loadingAuth={loadingAuth}
      authError={authError}
      handleRevokeKey={handleRevokeKey}
      onCreateKey={handleCreateKey}
    />
  )
}
