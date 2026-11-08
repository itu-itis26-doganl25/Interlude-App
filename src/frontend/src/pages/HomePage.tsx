import { Link } from 'react-router-dom';
import { paths } from '../app/paths';
import { Icon } from '../components/Icon';
import { useSession } from '../auth/SessionContext';

export function HomePage() {
  const { session } = useSession();
  const isMusician = session.status === 'authenticated' && session.role === 'musician';
  return (
    <div className="page-container">
      <div className="page-eyebrow"><span className="eyebrow-line" /> WELCOME TO INTERLUDE</div>
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        <div className="hero-content">
          <span className="hero-kicker"><span className="kicker-dot" /> A space for music & connection</span>
          <h1 id="home-title">Find your rhythm.<br /><em>Share the moment.</em></h1>
          <p>Discover new sounds, join listening rooms, and connect through the music you love.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to={paths.catalogue}>Explore music <Icon name="arrow" /></Link>
            <Link className="button button-ghost" to={paths.rooms}>Listening rooms</Link>
          </div>
        </div>
        <div className="hero-record" aria-hidden="true"><div className="record-center" /></div>
      </section>
      <div className="section-heading">
        <div><span className="section-overline">YOUR EXPERIENCE</span><h2>Make yourself at home</h2></div>
        <span className="subtle-note">Frontend foundation preview</span>
      </div>
      <div className="feature-grid">
        <Link to={paths.catalogue} className="feature-tile">
          <span className="feature-icon feature-icon-lavender"><Icon name="music" /></span>
          <strong>Discover music</strong><p>Browse songs, albums and artists from independent musicians.</p>
          <span className="feature-action">Open catalogue <Icon name="arrow" width="16" height="16" /></span>
        </Link>
        <Link to={paths.rooms} className="feature-tile">
          <span className="feature-icon feature-icon-peach"><Icon name="rooms" /></span>
          <strong>Listen together</strong><p>Join shared rooms for synchronized listening and conversation.</p>
          <span className="feature-action">Browse rooms <Icon name="arrow" width="16" height="16" /></span>
        </Link>
        {isMusician ? <Link to={paths.dashboard} className="feature-tile">
          <span className="feature-icon feature-icon-mint"><Icon name="chart" /></span>
          <strong>For musicians</strong><p>Understand your audience through basic listening insights.</p>
          <span className="feature-action">View dashboard <Icon name="arrow" width="16" height="16" /></span>
        </Link> : <Link to={paths.playlists} className="feature-tile">
          <span className="feature-icon feature-icon-mint"><Icon name="disc" /></span>
          <strong>Build your playlists</strong><p>Keep your favourite tracks together in your own library.</p>
          <span className="feature-action">My playlists <Icon name="arrow" width="16" height="16" /></span>
        </Link>}
      </div>
      <p className="foundation-note"><Icon name="disc" width="16" height="16" /> Layout and navigation are functional. Feature screens are placeholders until their owners implement them.</p>
    </div>
  );
}
