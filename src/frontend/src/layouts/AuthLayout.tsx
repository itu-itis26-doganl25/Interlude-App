import { Link, Outlet } from 'react-router-dom';
import { paths } from '../app/paths';
import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <header className="auth-header"><Brand /><Link to={paths.home} className="auth-back"><Icon name="arrow" /> Explore Interlude</Link></header>
      <main className="auth-main" id="main-content"><Outlet /></main>
      <footer className="auth-footer">Music sounds better together.</footer>
    </div>
  );
}
