import { useEffect, useState } from 'react'
import { MainLayout } from '../components/layout/MainLayout'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorMessage } from '../components/common/ErrorMessage'
import api from '../services/api'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const response = await api.get('/settings')
      setSettings(response.data.data || {})
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleSave = async () => {
    try {
      await api.post('/settings', settings)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings')
    }
  }

  return (
    <MainLayout title="Settings" onRefresh={load}>
      {loading ? <LoadingSpinner /> : error ? <ErrorMessage message={error} /> : (
        <div className="theme-panel p-5">
          <div className="mb-5 border-b border-[var(--border)] pb-3">
            <p className="panel-eyebrow">System</p>
            <h3 className="panel-title">Operational defaults</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Values are applied to forecasting, inventory thresholds, and the dashboard theme preference.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(settings).map(([key, value]) => (
              <label key={key} className="text-sm font-medium text-[var(--text-muted)]">
                <span className="mb-2 block capitalize">{key.replace(/_/g, ' ')}</span>
                <input
                  value={value}
                  onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="theme-input"
                />
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={handleSave} className="theme-button w-full sm:w-auto sm:px-6">Save settings</button>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
