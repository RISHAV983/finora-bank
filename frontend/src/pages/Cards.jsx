import { CreditCard, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, PageHeader, StatusBadge } from '../components/UI';
import { money } from '../utils/format';
export default function Cards() {
  const { user, cards, toggleCard } = useApp();
  const [shown, setShown] = useState({});
  return (
    <>
      <PageHeader title="Cards" description="View and manage your simulated Finora cards." />
      <div className="cards-grid">
        {cards.map((c) => {
          const isShown = shown[c.id];
          return (
            <Card key={c.id} className="card-management">
              <div className="bank-card">
                <div className="card-brand">
                  FINORA <span>{c.name.replace(/^finora\s*/i, '').toUpperCase()}</span>
                </div>
                <CreditCard />
                <strong>•••• •••• •••• {c.number}</strong>
                <div>
                  <span>
                    CARDHOLDER
                    <br />
                    <b>{(user?.name || 'Demo user').toUpperCase()}</b>
                  </span>
                  <span>
                    EXPIRES
                    <br />
                    <b>{c.expiry}</b>
                  </span>
                </div>
              </div>
              <div className="card-info">
                <div className="section-head">
                  <div>
                    <h2>{c.name}</h2>
                    <StatusBadge status={c.status} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShown((s) => ({ ...s, [c.id]: !isShown }))}
                    aria-expanded={Boolean(isShown)}
                    aria-label={`${isShown ? 'Hide' : 'Show'} demo details for ${c.name}`}
                  >
                    {isShown ? <EyeOff /> : <Eye />}
                    {isShown ? 'Hide' : 'Show'} demo details
                  </button>
                </div>
                <div className="limit">
                  <span>Available limit</span>
                  <strong>{money(c.limit - c.spent)}</strong>
                  <div className="limit-bar">
                    <i style={{ width: `${Math.min(100, (c.spent / c.limit) * 100)}%` }} />
                  </div>
                  <small>
                    {money(c.spent)} used of {money(c.limit)}
                  </small>
                </div>
                {isShown && (
                  <p className="card-demo-note">
                    Demo card ending in {c.number}. Full card numbers are never displayed in this
                    portfolio.
                  </p>
                )}
                <button
                  type="button"
                  className={`btn ${c.frozen ? 'btn-primary' : 'btn-secondary'} full`}
                  onClick={() => toggleCard(c.id)}
                >
                  {c.frozen ? (
                    <>
                      <Unlock size={16} /> Unfreeze demo card
                    </>
                  ) : (
                    <>
                      <Lock size={16} /> Freeze demo card
                    </>
                  )}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="page-footnote">Card controls are simulated. No card credentials are real.</p>
    </>
  );
}
