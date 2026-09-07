export const SIGNUP_ROLES = [
  {
    value: 'artist',
    title: 'Artist',
    copy: 'Release music, follow review and build your artist presence.',
  },
  {
    value: 'producer',
    title: 'Producer',
    copy: 'Publish beats, build packs and grow your producer catalogue.',
  },
  {
    value: 'writer',
    title: 'Writer',
    copy: 'Create stories, research and editorial work.',
  },
  {
    value: 'show_creator',
    title: 'Show or podcast creator',
    copy: 'Build shows, episodes and live experiences.',
  },
  {
    value: 'listener',
    title: 'Listener',
    copy: 'Discover music, build your Library and follow creators.',
  },
] as const

export type SignupRole = (typeof SIGNUP_ROLES)[number]['value']

const SIGNUP_ROLE_VALUES = new Set<string>(SIGNUP_ROLES.map((role) => role.value))

export function isSignupRole(value: unknown): value is SignupRole {
  return typeof value === 'string' && SIGNUP_ROLE_VALUES.has(value)
}

export function profileRoleForSignup(role: SignupRole): Exclude<SignupRole, 'producer'> | 'listener' {
  return role === 'producer' ? 'listener' : role
}
