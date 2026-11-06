import { useState } from 'react';
import { ArrowLeft, Check, Copy, Download, LockKeyhole } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Card, PageHeader, TransactionItem } from '../components/UI';
import { money } from '../utils/format';

// Spreadsheet apps run cells that start with these characters as formulas, so neutralise them.
const csvCell = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
function downloadTransactionsCsv(rows, accountId) {
  const header = ['Date', 'ID', 'Description', 'Category', 'Type', 'Amount', 'Status'];
  const lines = rows.map((t) =>
    [t.date, t.id, t.description, t.category, t.type, t.amount, t.status].map(csvCell).join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `finora-demo-${accountId}-activity.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AccountDetails() {
  const { id } = useParams();
  const { accounts, transactions } = useApp();
  const [copied, setCopied] = useState(false);
  const account = accounts.find((a) => a.id === id);
  const recent = transactions.slice(0, 6);
  async function copyAccountNumber() {
    try {
      await navigator.clipboard.writeText(`•••• •••• ${account.lastFour}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Clipboard access can be blocked; the masked number is still visible on screen. */
    }
  }
  if (!account)
    return (
      <Card>
        <h2>Account not found</h2>
        <Link to="/accounts">Back to accounts</Link>
      </Card>
    );
  return (
    <>
      <PageHeader
        title={account.name}
        description={`Simulated ${account.type.toLowerCase()} account ending ${account.lastFour}.`}
        action={
          <Link to="/accounts" className="btn btn-secondary">
            <ArrowLeft size={16} /> Accounts
          </Link>
        }
      />
      <div className="detail-grid">
        <Card className="balance-hero">
          <span>Current balance</span>
          <strong>{money(account.balance)}</strong>
          <small>Available {money(account.available)}</small>
        </Card>
        <Card>
          <div className="section-head">
            <h2>Account details</h2>
            <LockKeyhole size={18} />
          </div>
          <dl className="details">
            <div>
              <dt>Account type</dt>
              <dd>{account.type}</dd>
            </div>
            <div>
              <dt>Account number</dt>
              <dd>
                •••• •••• {account.lastFour}{' '}
                <button
                  type="button"
                  className="inline-icon"
                  aria-label={copied ? 'Account number copied' : 'Copy account number'}
                  onClick={copyAccountNumber}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{account.currency}</dd>
            </div>
            <div>
              <dt>Routing number</dt>
              <dd>•••• 1024</dd>
            </div>
          </dl>
        </Card>
        <Card className="span-2">
          <div className="section-head">
            <div>
              <h2>Account activity</h2>
              <p>Recent demo transactions</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadTransactionsCsv(recent, account.id)}
              disabled={recent.length === 0}
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
          {recent.map((t) => (
            <TransactionItem key={t.id} transaction={t} />
          ))}
        </Card>
      </div>
    </>
  );
}
