import { SessionProvider } from './auth/SessionContext';
import { AppRoutes } from './app/AppRoutes';

export default function App() {
  return <SessionProvider><AppRoutes /></SessionProvider>;
}
