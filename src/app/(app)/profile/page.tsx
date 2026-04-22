import { redirect } from 'next/navigation'
import { getSessionUniversal } from '@/lib/session'
import { profileService } from '@/services/profile.service'
import { organizationService } from '@/services/organization.service'
import { ProfileTabs } from '@/components/profile/profile-tabs'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await getSessionUniversal()
  if (!session?.user) {
    redirect('/login')
  }

  const profile = await profileService.getProfile(session.user.id)
  const organization = await organizationService.getById(session.user.organizationId || '')

  const profileData = {
    ...profile,
    organization: {
      id: organization?.id || '',
      name: organization?.name || '',
    },
  }

  return (
    <div className="p-6">
      <ProfileTabs initialProfile={profileData} />
    </div>
  )
}
