import { useState } from 'react';
import { ArrowRight, CheckCircle2, Receipt, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Card, PageHeader } from '../components/UI';
import { localISODate, money } from '../utils/format';
const providers = [
  ['Electricity', 'Metro Energy', '124.80'],
  ['Internet', 'CloudStream Internet', '59.99'],
  ['Mobile', 'Bright Mobile', '42.00'],
  ['Water', 'ClearWater Utilities', '38.50'],
  ['Insurance', 'HealthPlus Insurance', '112.00'],
];
export default function Bills() {
  const { accounts, addTransaction, updateAccountBalance, preferences } = useApp();
  const [provider, setProvider] = useState(0);
  const [customer, setCustomer] = useState('CUS-4821');
  const [amount, setAmount] = useState(providers[0][2]);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const account = accounts[0];
  function changeProvider(e) {
    const i = Number(e.target.value);
    setProvider(i);
    setAmount(providers[i][2]);
  }
  function review(e) {
    e.preventDefault();
    const n = Number(amount);
    if (!customer.trim()) return setError('Enter the customer or account number.');
    if (!Number.isFinite(n) || n <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(amount.trim()))
      return setError('Enter a valid amount with no more than two decimal places.');
    if (n > account.available) return setError('Amount exceeds the available demo balance.');
    setError('');
    if (preferences.security) {
      setStep(2);
    } else {
      void confirm();
    }
  }
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const response = await api.billPayment({
        provider: providers[provider][1],
        customer,
        amount: Number(amount),
      });
      addTransaction({
        id: `TX-BILL-${Date.now().toString().slice(-5)}`,
        date: localISODate(),
        description: `${providers[provider][1]} bill`,
        category: 'Bills',
        amount: -Number(amount),
        type: 'debit',
        status: 'Simulated',
      });
      updateAccountBalance(account.id, -Number(amount));
      setPaymentReference(response.reference);
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Bill payments" description="Pay a simulated utility or service bill." />
      <div className="workflow">
        <div className="steps">
          <span className="active">1. Details</span>
          <span className={step >= 2 ? 'active' : ''}>2. Review</span>
          <span className={done ? 'active' : ''}>3. Confirmation</span>
        </div>
        {!done && step === 1 && (
          <Card>
            <form className="form-grid" onSubmit={review}>
              <label>
                Provider
                <select value={provider} onChange={changeProvider}>
                  {providers.map((p, i) => (
                    <option key={p[1]} value={i}>
                      {p[0]} · {p[1]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Customer / account number
                <input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="CUS-0000"
                  maxLength={100}
                />
              </label>
              <label>
                Amount
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <div className="bill-preview">
                <Receipt />
                <div>
                  <strong>{providers[provider][1]}</strong>
                  <span>Suggested demo amount: {money(Number(providers[provider][2]))}</span>
                </div>
              </div>
              {error && (
                <div className="form-error full-row" role="alert">
                  {error}
                </div>
              )}
              <div className="form-actions full-row">
                <span className="secure">
                  <ShieldCheck size={16} /> Simulated only
                </span>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Processing…' : 'Review payment'} <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </Card>
        )}
        {!done && step === 2 && (
          <Card>
            <h2>Review bill payment</h2>
            <dl className="details">
              <div>
                <dt>Provider</dt>
                <dd>{providers[provider][1]}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>{customer}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{money(Number(amount))}</dd>
              </div>
              <div>
                <dt>Funding account</dt>
                <dd>{account.name}</dd>
              </div>
            </dl>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                Edit
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={confirm}>
                {busy ? 'Processing…' : 'Confirm demo payment'} <ArrowRight size={16} />
              </button>
            </div>
          </Card>
        )}
        {done && (
          <Card className="success-card">
            <CheckCircle2 size={52} />
            <h2>Bill payment simulated</h2>
            <p>
              No real payment was sent. Your demo account and transaction list were updated locally.
            </p>
            <p>
              <strong>Reference:</strong> {paymentReference}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setDone(false);
                setStep(1);
              }}
            >
              Pay another bill
            </button>
          </Card>
        )}
      </div>
    </>
  );
}
