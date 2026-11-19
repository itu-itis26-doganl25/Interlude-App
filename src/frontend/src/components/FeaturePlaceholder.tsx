import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface FeaturePlaceholderProps {
  label: string;
  title: string;
  description: string;
  icon?: IconName;
  detail?: string;
}

/** Replace this with the feature owner's actual page when their PR lands. */
export function FeaturePlaceholder({
  label,
  title,
  description,
  icon = 'music',
  detail,
}: FeaturePlaceholderProps) {
  return (
    <section className="page-container" aria-label={title}>
      <div className="page-eyebrow"><span className="eyebrow-line" />{label}</div>
      <h1 className="page-heading">{title}</h1>
      <p className="page-lede">{description}</p>
      <div className="placeholder-card">
        <div className="placeholder-icon"><Icon name={icon} width="36" height="36" /></div>
        <div>
          <span className="status-tag">FOUNDATION READY</span>
          <h2>Page route is connected</h2>
          <p>{detail || 'This is a temporary screen. The feature team can now implement this page without rebuilding navigation or layout.'}</p>
          <Link className="text-link" to="/">Back to home <Icon name="arrow" width="17" height="17" /></Link>
        </div>
      </div>
    </section>
  );
}
