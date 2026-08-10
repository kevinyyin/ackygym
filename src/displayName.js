export function displayName(profile) {
  return profile.username || profile.email.split('@')[0]
}
