export const SIGNUP_ROLES = [
  {
    value: 'artist',
    title: 'Artist',
    copy: 'Submit music and start with artist tools.',
  },
  {
    value: 'producer',
    title: 'Producer',
    copy: 'Upload beats and start with producer tools.',
  },
  {
    value: 'writer',
    title: 'Writer',
    copy: 'Pitch stories and start with writing tools.',
  },
  {
    value: 'show_creator',
    title: 'Show or podcast creator',
    copy: 'Start a show and manage episode workflows.',
  },
  {
    value: 'listener',
    title: 'Listener',
    copy: 'Discover, save and support BVS creators.',
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
