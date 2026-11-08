import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { paths } from '../app/paths';
import { useSession } from './SessionContext';
import type { AccountRole } from './SessionContext';

/** Guest pages stay public; feature pages need a known authenticated session. */
export function RequireSession() {
  const { session } = useSession();
  const location = useLocation();
  if (session.status === 'loading') return <main className="loading-screen" role="status">Checking your session…</main>;
  if (session.status === 'guest') {
    return <Navigate to={paths.login} replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}

/** UI gating is not server-side authorization; Django must enforce RBAC. */
export function RequireRole({ allowed }: { allowed: AccountRole[] }) {
  const { session } = useSession();
  if (session.status !== 'authenticated') return <Navigate to={paths.login} replace />;
  if (!allowed.includes(session.role)) return <Navigate to={paths.home} replace />;
  return <Outlet />;
}
