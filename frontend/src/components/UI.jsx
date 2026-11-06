import { Link } from 'react-router-dom';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Loader2 } from 'lucide-react';
import { money, date } from '../utils/format';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Card({ children, className = '' }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state">
      <Loader2 className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({ message = 'Unable to load this section.', retry }) {
  return (
    <div className="state error">
      <AlertCircle size={22} />
      <span>{message}</span>
      {retry && (
        <Button variant="ghost" onClick={retry}>
          Retry
        </Button>
      )}
    </div>
  );
}
export function EmptyState({
  title = 'Nothing here yet',
  message = 'There is no data to display.',
}) {
  return (
    <div className="state">
      <CheckCircle2 size={22} />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
export function StatusBadge({ status }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}
export function TransactionItem({ transaction }) {
  const credit = transaction.type === 'credit';
  return (
    <div className="transaction-item">
      <div className={`transaction-icon ${credit ? 'credit' : 'debit'}`}>
        {credit ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
      </div>
      <div className="transaction-main">
        <strong>{transaction.description}</strong>
        <span>
          {transaction.category} · {date(transaction.date)}
        </span>
      </div>
      <div className={`amount ${credit ? 'positive' : 'negative'}`}>
        {credit ? '+' : ''}
        {money(transaction.amount)}
      </div>
      <StatusBadge status={transaction.status} />
    </div>
  );
}
export function PageHeader({ eyebrow = 'Finora Bank', title, description, action }) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function QuickAction({ to, icon: Icon, label }) {
  return (
    <Link className="quick-action" to={to}>
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
}
export function DemoBanner() {
  return (
    <div className="demo-banner">
      <strong>Demo environment</strong>
      <span>
        All balances, cards and transactions are simulated portfolio data. No real financial
        transaction can be performed.
      </span>
    </div>
  );
}
