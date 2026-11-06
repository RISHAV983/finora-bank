import { Bell, CheckCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, PageHeader } from '../components/UI';
export default function Notifications() {
  const { notifications, markRead, preferences } = useApp();
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Security alerts and activity from your demo session."
      />
      {!preferences.notifications ? (
        <Card>
          <h2>Notifications are turned off</h2>
          <p>Enable them again in Settings to see demo security and payment alerts.</p>
        </Card>
      ) : (
        <div className="notification-list">
          {notifications.map((n) => (
            <Card key={n.id} className={n.read ? 'read' : ''}>
              <div className="notification-row">
                <div className="notification-icon">
                  <Bell size={18} />
                </div>
                <div>
                  <h2>{n.title}</h2>
                  <p>{n.message}</p>
                  <small>{n.time}</small>
                </div>
                {!n.read && (
                  <button type="button" className="btn btn-ghost" onClick={() => markRead(n.id)}>
                    <CheckCheck size={16} /> Mark read
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
