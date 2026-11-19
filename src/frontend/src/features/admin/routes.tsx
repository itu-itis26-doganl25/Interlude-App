import { Route } from 'react-router-dom';
import { paths } from '../../app/paths';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

// FR-52: role-restricted shell; auth/profiles owner integrates admin report handling.
export const adminRoutes = [
  <Route key="admin-reports" path={paths.adminReports} element={
    <FeaturePlaceholder label="ADMIN" title="Copyright reports" icon="user"
      description="Review submitted copyright complaints."
      detail="The auth and profiles owner will connect report moderation to server-authorized APIs." />
  } />,
];
