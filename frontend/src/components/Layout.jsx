import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { DemoBanner } from './UI';
import Chatbot from './Chatbot';
export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar mobileOpen={open} closeMobile={() => setOpen(false)} />
      {open && (
        <button className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />
      )}
      <div className="app-main">
        <Topbar onMenu={() => setOpen(true)} />
        <main>
          <DemoBanner />
          <Outlet />
        </main>
      </div>
      <Chatbot />
    </div>
  );
}
