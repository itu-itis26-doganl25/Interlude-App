import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { paths, links } from '../app/paths';
import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';
import { Navigation } from '../components/Navigation';
import { PlayerBar } from '../components/PlayerBar';

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query) navigate(links.search(query));
    else navigate(paths.search);
    setMobileNavOpen(false);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-brand"><Brand /></div>
        <Navigation onNavigate={() => setMobileNavOpen(false)} />
        <div className="sidebar-bottom">
          <span className="sidebar-bottom-icon"><Icon name="headphones" /></span>
          <div>
            <strong>Better together.</strong>
            <p>Find your next favourite sound.</p>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-nav-toggle icon-button"
            type="button"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <Icon name={mobileNavOpen ? 'close' : 'menu'} />
          </button>
          <form className="search-form" role="search" onSubmit={handleSearch}>
            <Icon name="search" />
            <input
              aria-label="Search music"
              placeholder="Search for music, artists, albums..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button className="search-submit" type="submit">Search</button>
          </form>
          <Link className="sign-in-link" to={paths.profile}>My profile <Icon name="arrow" width="16" height="16" /></Link>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <PlayerBar />
        <footer className="app-footer">Interlude <span aria-hidden="true">·</span> Built for listening together</footer>
      </div>
    </div>
  );
}
