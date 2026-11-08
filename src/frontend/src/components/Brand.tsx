import { Link } from 'react-router-dom';
import { paths } from '../app/paths';

export function Brand() {
  return (
    <Link className="brand" to={paths.home} aria-label="Interlude home">
      <span className="brand-mark" aria-hidden="true">i<span>·</span></span>
      <span>interlude<span className="brand-dot">.</span></span>
    </Link>
  );
}
