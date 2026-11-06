import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Bot,
  CreditCard,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
const links = [
  ['Dashboard', '/', LayoutDashboard],
  ['Accounts', '/accounts', WalletCards],
  ['Transactions', '/transactions', ReceiptText],
  ['Transfer', '/transfer', BarChart3],
  ['Bill payments', '/bills', ReceiptText],
  ['Beneficiaries', '/beneficiaries', Users],
  ['Cards', '/cards', CreditCard],
  ['Notifications', '/notifications', Bell],
  ['Assistant', '/assistant', Bot],
];
export default function Sidebar({ mobileOpen, closeMobile }) {
  const { logout, notifications, preferences } = useApp();
  const unread = preferences.notifications ? notifications.filter((n) => !n.read).length : 0;
  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          <strong>Finora</strong>
          <span>Banking demo</span>
        </div>
      </div>
      <nav>
        {links.map(([label, to, Icon]) => (
          <NavLink
            key={to}
            to={to}
            onClick={closeMobile}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
            {label === 'Notifications' && unread > 0 && <small>{unread}</small>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <NavLink to="/profile" onClick={closeMobile} className="nav-link">
          <UserRound size={18} />
          <span>Profile</span>
        </NavLink>
        <NavLink to="/settings" onClick={closeMobile} className="nav-link">
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
        <button className="nav-link logout" onClick={logout}>
          <LogOut size={18} />
          <span>Log out</span>
        </button>
        <div className="secure">
          <ShieldCheck size={16} />
          <span>Secure demo session</span>
        </div>
      </div>
    </aside>
  );
}
