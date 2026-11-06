import { Bell, Menu, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { initials } from '../utils/format';

export default function Topbar({ onMenu }) {
  const { user, notifications, preferences } = useApp();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const unread = preferences.notifications
    ? notifications.filter((notification) => !notification.read).length
    : 0;

  function submitSearch(event) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/transactions?search=${encodeURIComponent(value)}` : '/transactions');
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button mobile-menu"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu aria-hidden="true" />
      </button>
      <form className="top-search" role="search" onSubmit={submitSearch}>
        <Search size={17} aria-hidden="true" />
        <input
          aria-label="Search transactions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search transactions…"
        />
        <button type="submit" className="sr-only">
          Search
        </button>
      </form>
      <div className="top-actions">
        <Link
          className="icon-button"
          to="/notifications"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <Bell size={19} aria-hidden="true" />
          {unread > 0 && <i aria-hidden="true" />}
        </Link>
        <Link className="profile-chip" to="/profile">
          <span className="avatar" aria-hidden="true">
            {initials(user?.name)}
          </span>
          <span className="profile-name">{user?.name || 'Demo user'}</span>
        </Link>
      </div>
    </header>
  );
}
