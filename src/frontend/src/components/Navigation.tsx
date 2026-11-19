import { NavLink } from 'react-router-dom';
import { useSession } from '../auth/SessionContext';
import { paths } from '../app/paths';
import { Icon } from './Icon';
import type { IconName } from './Icon';

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };
const primary: NavItem[] = [
  { to: paths.home, label: 'Home', icon: 'home', end: true },
  { to: paths.catalogue, label: 'Music catalogue', icon: 'music' },
  { to: paths.search, label: 'Search', icon: 'search' },
  { to: paths.rooms, label: 'Listening rooms', icon: 'rooms' },
  { to: paths.playlists, label: 'My playlists', icon: 'disc' },
];
const personal: NavItem[] = [{ to: paths.profile, label: 'My profile', icon: 'user' }];
const musician: NavItem[] = [{ to: paths.dashboard, label: 'Musician dashboard', icon: 'chart' }];
const admin: NavItem[] = [{ to: paths.adminReports, label: 'Copyright reports', icon: 'chart' }];

function NavGroup({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div className="nav-group">
      {items.map(({ to, label, icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate}
          className={({ isActive }) => `nav-item${isActive ? ' nav-item-active' : ''}`}>
          <Icon name={icon} /><span>{label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useSession();
  const extra = session.status === 'authenticated'
    ? (session.role === 'musician' ? musician : session.role === 'admin' ? admin : [])
    : [];
  return (
    <nav aria-label="Primary navigation" className="navigation">
      <span className="nav-caption">EXPLORE</span>
      <NavGroup items={primary} onNavigate={onNavigate} />
      <span className="nav-caption nav-caption-separated">YOUR SPACE</span>
      <NavGroup items={[...personal, ...extra]} onNavigate={onNavigate} />
    </nav>
  );
}
