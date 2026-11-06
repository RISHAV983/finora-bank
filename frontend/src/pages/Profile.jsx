import { useState } from 'react';
import { Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, PageHeader } from '../components/UI';
import { initials } from '../utils/format';
export default function Profile() {
  const { user } = useApp();
  const [notice, setNotice] = useState('');
  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage the basic information used in this demo session."
      />
      <div className="profile-grid">
        <Card className="profile-summary">
          <div className="avatar huge" aria-hidden="true">
            {initials(user?.name)}
          </div>
          <h2>{user?.name || 'Demo user'}</h2>
          <p>{user?.email || ''}</p>
          <span className="badge badge-completed">
            <ShieldCheck size={14} /> Verified demo
          </span>
        </Card>
        <Card>
          <h2>Personal information</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setNotice('Demo only: profile changes are not stored.');
            }}
          >
            <div className="form-grid">
              <label>
                Full name
                <input defaultValue={user?.name || ''} maxLength={80} />
              </label>
              <label>
                Email address
                <div className="input-with-icon">
                  <Mail size={16} />
                  <input defaultValue={user?.email || ''} readOnly aria-readonly="true" />
                </div>
              </label>
              <label>
                Phone number
                <div className="input-with-icon">
                  <Phone size={16} />
                  <input defaultValue="+1 (555) 014-2048" />
                </div>
              </label>
              <label>
                Profile type
                <select defaultValue="Personal">
                  <option>Personal</option>
                  <option>Demo business</option>
                </select>
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              Save demo profile
            </button>
            {notice && (
              <p className="muted" role="status">
                {notice}
              </p>
            )}
          </form>
        </Card>
        <Card>
          <div className="section-head">
            <div>
              <h2>Identity</h2>
              <p>Safe portfolio implementation</p>
            </div>
            <UserRound />
          </div>
          <p className="muted">
            No government IDs, real banking credentials, or sensitive identity data are collected by
            this application.
          </p>
        </Card>
      </div>
    </>
  );
}
