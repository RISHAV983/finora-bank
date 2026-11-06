import { Bell, Eye, LockKeyhole, Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, PageHeader } from '../components/UI';

export default function Settings() {
  const { preferences, updatePreference } = useApp();
  const settings = [
    {
      key: 'notifications',
      title: 'Notifications',
      description: 'Show security and payment alerts.',
      Icon: Bell,
    },
    {
      key: 'compact',
      title: 'Compact transaction view',
      description: 'Use denser rows when reviewing activity.',
      Icon: Eye,
    },
    {
      key: 'security',
      title: 'Security confirmations',
      description: 'Require a review step before simulated transfers and bill payments.',
      Icon: LockKeyhole,
    },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Adjust preferences for this portfolio experience."
      />
      <div className="settings-list">
        {settings.map(({ key, title, description, Icon }) => (
          <Card key={key}>
            <div className="setting">
              <div className="setting-icon">
                <Icon aria-hidden="true" />
              </div>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <button
                type="button"
                className={`switch ${preferences[key] ? 'on' : ''}`}
                onClick={() => updatePreference(key, !preferences[key])}
                aria-label={`${preferences[key] ? 'Disable' : 'Enable'} ${title.toLowerCase()}`}
                aria-pressed={preferences[key]}
              >
                <i />
              </button>
            </div>
          </Card>
        ))}
        <Card>
          <div className="setting">
            <div className="setting-icon">
              <SettingsIcon aria-hidden="true" />
            </div>
            <div>
              <h2>Application mode</h2>
              <p>Portfolio demonstration · simulated financial data</p>
            </div>
            <span className="badge badge-completed">Active</span>
          </div>
        </Card>
      </div>
    </>
  );
}
