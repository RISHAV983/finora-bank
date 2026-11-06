import {
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  DollarSign,
  Eye,
  Plus,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Card, PageHeader, QuickAction, TransactionItem } from '../components/UI';
import { greeting, money } from '../utils/format';
import { upcomingPayments } from '../data/mockData';
export default function Dashboard() {
  const { user, accounts, transactions, notifications, cards, preferences } = useApp();
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const available = accounts.reduce((s, a) => s + a.available, 0);
  const debits = transactions.filter((t) => t.type === 'debit');
  const spend = debits.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalsByCategory = debits.reduce(
    (totals, t) => ({ ...totals, [t.category]: (totals[t.category] || 0) + Math.abs(t.amount) }),
    {},
  );
  const spendingBreakdown = Object.entries(totalsByCategory)
    .map(([label, amount]) => ({
      label,
      amount,
      percentage: spend ? Math.round((amount / spend) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return (
    <>
      <PageHeader
        eyebrow={user?.name ? `${greeting()}, ${user.name.trim().split(/\s+/)[0]}` : greeting()}
        title="Your financial snapshot"
        description="A clear view of your simulated accounts, spending and upcoming activity."
        action={
          <Link to="/transfer" className="btn btn-primary">
            <Plus size={17} /> New transfer
          </Link>
        }
      />
      <div className="metric-grid">
        <Card>
          <div className="metric-head">
            <span>Total balance</span>
            <DollarSign size={18} />
          </div>
          <strong className="metric-value">{money(total)}</strong>
          <small>Fictional demo balance</small>
        </Card>
        <Card>
          <div className="metric-head">
            <span>Available balance</span>
            <Wallet size={18} />
          </div>
          <strong className="metric-value">{money(available)}</strong>
          <small>
            Across {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </small>
        </Card>
        <Card>
          <div className="metric-head">
            <span>Total demo spending</span>
            <TrendingUp size={18} />
          </div>
          <strong className="metric-value">{money(spend)}</strong>
          <small>{transactions.length} demo transactions</small>
        </Card>
        <Card>
          <div className="metric-head">
            <span>Cards</span>
            <CreditCard size={18} />
          </div>
          <strong className="metric-value">{cards.length}</strong>
          <small>{cards.filter((c) => !c.frozen).length} active</small>
        </Card>
      </div>
      <div className="dashboard-grid">
        <Card className="span-2">
          <div className="section-head">
            <div>
              <h2>Recent transactions</h2>
              <p>Latest simulated account activity</p>
            </div>
            <Link to="/transactions">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="transaction-list">
            {transactions.slice(0, 5).map((t) => (
              <TransactionItem key={t.id} transaction={t} />
            ))}
          </div>
        </Card>
        <Card>
          <div className="section-head">
            <div>
              <h2>Spending summary</h2>
              <p>By category across listed demo activity</p>
            </div>
          </div>
          <div className="spending-chart">
            <div className="chart-total">
              {money(spend)}
              <span>Total spending</span>
            </div>
            {spendingBreakdown.map(({ label, amount, percentage }) => (
              <div className="bar-row" key={label}>
                <div>
                  <span>{label}</span>
                  <strong>
                    {percentage}% · {money(amount)}
                  </strong>
                </div>
                <div className="bar">
                  <i style={{ width: `${percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="section-head">
            <div>
              <h2>Upcoming payments</h2>
              <p>Next scheduled items</p>
            </div>
            <CalendarDays size={18} />
          </div>
          <div className="upcoming-list">
            {upcomingPayments.map((p) => (
              <div className="upcoming" key={p.name}>
                <div className="mini-icon">
                  <Receipt size={16} />
                </div>
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {p.category} · due {p.due}
                  </span>
                </div>
                <b>{money(p.amount)}</b>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="section-head">
            <div>
              <h2>Quick actions</h2>
              <p>Common tasks</p>
            </div>
          </div>
          <div className="quick-grid">
            <QuickAction to="/transfer" icon={ArrowUpRight} label="Transfer money" />
            <QuickAction to="/bills" icon={Receipt} label="Pay a bill" />
            <QuickAction to="/transactions" icon={Eye} label="Transactions" />
            <QuickAction to="/cards" icon={CreditCard} label="Manage cards" />
          </div>
        </Card>
        <Card>
          <div className="section-head">
            <div>
              <h2>Security status</h2>
              <p>Demo session health</p>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className="security-box">
            <strong>Protected demo session</strong>
            <span>
              No real financial data is stored. Authentication is verified by the Flask backend for
              this demo.
            </span>
          </div>
          {preferences.notifications ? (
            <div className="notification-preview">
              {notifications.slice(0, 2).map((n) => (
                <div key={n.id}>
                  <span className={n.read ? 'dot muted' : 'dot'} />
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Notifications are disabled in Settings.</p>
          )}
        </Card>
      </div>
    </>
  );
}
