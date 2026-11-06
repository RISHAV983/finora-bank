import { ArrowRight, Landmark, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Card, PageHeader } from '../components/UI';
import { money } from '../utils/format';
export default function Accounts() {
  const { accounts } = useApp();
  return (
    <>
      <PageHeader
        title="Accounts"
        description="Manage your simulated checking and savings accounts."
      />
      <div className="account-grid">
        {accounts.map((a) => (
          <Card key={a.id} className="account-card">
            <div className="account-top">
              <div className="account-icon">
                <Landmark size={21} />
              </div>
              <span>{a.type}</span>
            </div>
            <h2>{a.name}</h2>
            <span className="muted">Account ending {a.lastFour}</span>
            <strong className="account-balance">{money(a.balance)}</strong>
            <div className="account-available">
              <span>Available</span>
              <b>{money(a.available)}</b>
            </div>
            <Link className="text-link" to={`/accounts/${a.id}`}>
              View account details <ArrowRight size={15} />
            </Link>
          </Card>
        ))}
      </div>
      <Card className="account-note">
        <Wallet />
        <div>
          <h2>About demo balances</h2>
          <p>
            Balances are seeded locally for this portfolio project. Transfer and bill-payment
            workflows update the interface only; they do not move real money.
          </p>
        </div>
      </Card>
    </>
  );
}
