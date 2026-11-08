import { Link } from 'react-router-dom';
import { paths } from '../app/paths';
import { Icon } from '../components/Icon';

export function NotFoundPage() {
  return (
    <main className="not-found">
      <span className="not-found-number">404</span>
      <h1>That track is missing.</h1>
      <p>We couldn't find the page you're looking for.</p>
      <Link to={paths.home} className="button button-primary">Back to Interlude <Icon name="arrow" /></Link>
    </main>
  );
}
