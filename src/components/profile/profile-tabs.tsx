'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { PersonalInfoTab } from './personal-info-tab'
import { OrganizationTab } from './organization-tab'
import { SecurityTab } from './security-tab'
import { PreferencesTab } from './preferences-tab'
import { PrivacyTab } from './privacy-tab'

export type ProfileData = {
  id: string
  name: string
  email: string
  phone: string | null
  image: string | null
  role: string
  language: string
  notificationsEnabled: boolean
  emailNotifications: boolean
  smsNotifications: boolean
  gdprConsentGiven: boolean
  twoFactorEnabled: boolean
  organization: {
    id: string
    name: string
  }
}

const tabs = [
  { key: 'personal', label: 'Datos personales' },
  { key: 'organization', label: 'Organización' },
  { key: 'security', label: 'Seguridad' },
  { key: 'preferences', label: 'Preferencias' },
  { key: 'privacy', label: 'Privacidad' },
]

export function ProfileTabs({ initialProfile }: { initialProfile: ProfileData }) {
  const [activeTab, setActiveTab] = useState('personal')
  const [profile, setProfile] = useState(initialProfile)
  const { post } = useApi()

  async function updateProfile(data: Partial<ProfileData>) {
    const res = await post<{ user: ProfileData }>('/api/profile', data, { method: 'PATCH' })
    setProfile(res.user)
    return res.user
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold text-primary">Mi Perfil</h1>

      {/* Mobile dropdown */}
      <div className="mb-4 md:hidden">
        <select
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
        >
          {tabs.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar tabs */}
        <nav className="hidden w-48 shrink-0 flex-col gap-1 md:flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {activeTab === 'personal' && (
            <PersonalInfoTab profile={profile} onUpdate={updateProfile} />
          )}
          {activeTab === 'organization' && <OrganizationTab profile={profile} />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'preferences' && (
            <PreferencesTab profile={profile} onUpdate={updateProfile} />
          )}
          {activeTab === 'privacy' && <PrivacyTab profile={profile} />}
        </div>
      </div>
    </div>
  )
}
