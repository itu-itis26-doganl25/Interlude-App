import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { RequireSession, RequireRole } from '../auth/RouteGuards';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { authRoutes } from '../features/auth/routes';
import { catalogueRoutes } from '../features/catalogue/routes';
import { playlistRoutes } from '../features/playlists/routes';
import { roomRoutes } from '../features/rooms/routes';
import { profileRoutes } from '../features/profiles/routes';
import { analyticsRoutes } from '../features/analytics/routes';
import { adminRoutes } from '../features/admin/routes';

/** Feature owners replace their placeholders without editing the shared layout. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>{authRoutes}</Route>
      <Route element={<RequireSession />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          {catalogueRoutes}
          {playlistRoutes}
          {roomRoutes}
          {profileRoutes}
          <Route element={<RequireRole allowed={['musician']} />}>{analyticsRoutes}</Route>
          <Route element={<RequireRole allowed={['admin']} />}>{adminRoutes}</Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

// SessionContext is a frontend bridge, not a backend login implementation.
// Authentication owner must validate the actual session and connect this state.
