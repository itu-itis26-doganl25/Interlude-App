import { Route } from 'react-router-dom';
import { paths } from '../../app/paths';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

// Ownership: authentication & profile developer. Replace temporary elements here.
export const authRoutes = [
  <Route key="login" path={paths.login} element={
    <FeaturePlaceholder label="ACCOUNT" title="Sign in" icon="user"
      description="Welcome back. Your music and listening rooms are waiting."
      detail="The authentication owner will add the login form and connect it to the Django auth API." />
  } />,
  <Route key="register" path={paths.register} element={
    <FeaturePlaceholder label="ACCOUNT" title="Create an account" icon="user"
      description="Join Interlude as a listener or an independent musician."
      detail="The authentication owner will add registration, validation, and account role selection." />
  } />,
];
