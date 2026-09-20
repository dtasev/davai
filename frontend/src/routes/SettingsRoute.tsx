import React from 'react'
import { useApp } from '../context/AppContext'
import { SettingsView } from '../components/Settings/SettingsView'

export function SettingsRoute() {
  const {
    apiKey,
    apiKeyInput,
    setApiKeyInput,
    handleSaveApiKey,
    userProfile,
    apiKeys,
    loadingAuth,
    authError,
    handleRevokeKey,
    handleCreateKey
  } = useApp()

  return (
    <SettingsView
      apiKey={apiKey}
      apiKeyInput={apiKeyInput}
      setApiKeyInput={setApiKeyInput}
      handleSaveApiKey={handleSaveApiKey}
      userProfile={userProfile}
      apiKeys={apiKeys}
      loadingAuth={loadingAuth}
      authError={authError}
      handleRevokeKey={handleRevokeKey}
      onCreateKey={handleCreateKey}
    />
  )
}
