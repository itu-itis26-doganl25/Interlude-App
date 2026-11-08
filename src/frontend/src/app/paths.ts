/** Shared URL contract. Keep routes stable as feature teams replace placeholders. */
export const paths = {
  home: '/',
  catalogue: '/catalogue',
  search: '/search',
  track: '/tracks/:trackId',
  album: '/albums/:albumId',
  playlists: '/playlists',
  playlist: '/playlists/:playlistId',
  rooms: '/rooms',
  room: '/rooms/:roomId',
  login: '/login',
  register: '/register',
  profile: '/profile',
  editProfile: '/profile/edit',
  followers: '/profile/followers',
  following: '/profile/following',
  user: '/users/:userId',
  musician: '/musicians/:musicianId',
  reportMusician: '/musicians/:musicianId/report',
  dashboard: '/dashboard',
  adminReports: '/admin/reports',
} as const;

export const links = {
  track: (id: string) => `/tracks/${encodeURIComponent(id)}`,
  album: (id: string) => `/albums/${encodeURIComponent(id)}`,
  playlist: (id: string) => `/playlists/${encodeURIComponent(id)}`,
  room: (id: string) => `/rooms/${encodeURIComponent(id)}`,
  user: (id: string) => `/users/${encodeURIComponent(id)}`,
  musician: (id: string) => `/musicians/${encodeURIComponent(id)}`,
  reportMusician: (id: string) => `/musicians/${encodeURIComponent(id)}/report`,
  search: (query: string) => `/search?q=${encodeURIComponent(query)}`,
};
