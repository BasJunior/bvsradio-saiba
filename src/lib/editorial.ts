export type EditorialRole = 'administrator' | 'editor' | 'programmer' | 'credits_editor' | 'commerce_manager'
export type EditorialPermission = 'approve_submissions' | 'publish_artists' | 'manage_rotation' | 'schedule_programmes' | 'verify_credits' | 'manage_licensing' | 'manage_staff'

export const rolePermissions: Record<EditorialRole, EditorialPermission[]> = {
  administrator: ['approve_submissions', 'publish_artists', 'manage_rotation', 'schedule_programmes', 'verify_credits', 'manage_licensing', 'manage_staff'],
  editor: ['approve_submissions', 'publish_artists'],
  programmer: ['manage_rotation', 'schedule_programmes'],
  credits_editor: ['verify_credits'],
  commerce_manager: ['manage_licensing'],
}

export const roleLabels: Record<EditorialRole, string> = {
  administrator: 'Administrator', editor: 'Editor', programmer: 'Programmer', credits_editor: 'Credits editor', commerce_manager: 'Commerce manager',
}
