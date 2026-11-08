import { Route } from 'react-router-dom';
import { paths } from '../../app/paths';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

// Ownership: analytics/dashboard developer; only musicians should access real data.
export const analyticsRoutes = [
  <Route key="dashboard" path={paths.dashboard} element={
    <FeaturePlaceholder label="ARTIST SPACE" title="Musician dashboard" icon="chart"
      description="Track how your music connects with listeners."
      detail="The analytics owner will add authenticated, musician-only metrics and charts. Server-side RBAC remains required." />
  } />,
];
