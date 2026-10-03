export const webDestinations = [
  { href: '/', label: 'Home', id: 'home' },
  { href: '/feed', label: 'Feed', id: 'feed' },
  { href: '/search', label: 'Discover', id: 'explore' },
  { href: '/library', label: 'Library', id: 'library' },
  { href: '/creator/studio', label: 'Studio', id: 'studio' },
] as const;
export function isWebDestinationActive(id: typeof webDestinations[number]['id'], pathname: string) {
  if (id === 'home') return pathname === '/';
  if (id === 'feed') return pathname === '/feed' || pathname.startsWith('/feed/');
  if (id === 'library') return pathname === '/library' || pathname.startsWith('/library/');
  if (id === 'studio') return pathname === '/creator/studio' || pathname.startsWith('/creator/studio/') || pathname === '/creator/marketplace' || pathname === '/artists';
  return ['/search', '/catalogue', '/artist', '/album', '/music', '/shows', '/blog', '/articles', '/producers'].some(path => pathname === path || pathname.startsWith(`${path}/`));
}
