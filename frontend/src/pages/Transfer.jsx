import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Card, PageHeader } from '../components/UI';
import { localISODate, money } from '../utils/format';
export default function Transfer() {
  const navigate = useNavigate();
  const { accounts, beneficiaries, addTransaction, updateAccountBalance, preferences } = useApp();
  const [step, setStep] = useState(1);
  const [source, setSource] = useState(accounts[0]?.id || '');
  const [beneficiary, setBeneficiary] = useState(beneficiaries[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const selectedAccount = accounts.find((a) => a.id === source);
  const selectedBeneficiary = beneficiaries.find((b) => b.id === beneficiary);
  function review(e) {
    e.preventDefault();
    const value = Number(amount);
    if (!selectedAccount || !selectedBeneficiary)
      return setError('Select an account and beneficiary.');
    if (!Number.isFinite(value) || value <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(amount.trim()))
      return setError('Enter a valid amount with no more than two decimal places.');
    if (value > selectedAccount.available)
      return setError('Amount exceeds the available demo balance.');
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
      const response = await api.transfer({
        sourceAccount: source,
        beneficiaryId: beneficiary,
        amount: Number(amount),
        note,
      });
      const now = localISODate();
      addTransaction({
        id: `TX-DEMO-${Date.now().toString().slice(-5)}`,
        date: now,
        description: `Transfer to ${selectedBeneficiary.name}`,
        category: 'Transfer',
        amount: -Number(amount),
        type: 'debit',
        status: 'Simulated',
      });
      updateAccountBalance(source, -Number(amount));
      setResult({ reference: response.reference });
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Transfer money"
        description="A simulated transfer flow with review and confirmation."
      />
      <div className="workflow">
        <div className="steps">
          <span className={step >= 1 ? 'active' : ''}>1. Details</span>
          <span className={step >= 2 ? 'active' : ''}>2. Review</span>
          <span className={step >= 3 ? 'active' : ''}>3. Confirmation</span>
        </div>
        {step === 1 && (
          <Card>
            <form className="form-grid" onSubmit={review}>
              <label>
                From account
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {money(a.available)} available
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Beneficiary
                <select value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)}>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.account}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount
                <input
                  id="transfer-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  autoComplete="off"
                  aria-describedby={error ? 'transfer-error' : undefined}
                />
              </label>
              <label>
                Note <span className="optional">Optional</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. September rent"
                />
              </label>
              {error && (
                <div id="transfer-error" className="form-error full-row" role="alert">
                  {error}
                </div>
              )}
              <div className="form-actions full-row">
                <span className="secure">
                  <ShieldCheck size={16} /> Simulated only
                </span>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Processing…' : 'Review transfer'} <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </Card>
        )}
        {step === 2 && (
          <Card>
            <div className="review-box">
              <h2>Review transfer</h2>
              <p>Check the simulated details before confirming.</p>
              <dl className="details">
                <div>
                  <dt>From</dt>
                  <dd>{selectedAccount?.name}</dd>
                </div>
                <div>
                  <dt>To</dt>
                  <dd>
                    {selectedBeneficiary?.name} · {selectedBeneficiary?.account}
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{money(Number(amount))}</dd>
                </div>
                <div>
                  <dt>Note</dt>
                  <dd>{note || '—'}</dd>
                </div>
              </dl>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                <ArrowLeft size={16} /> Edit
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={confirm}>
                {busy ? 'Confirming…' : 'Confirm demo transfer'} <ArrowRight size={16} />
              </button>
            </div>
          </Card>
        )}
        {step === 3 && result && (
          <Card className="success-card">
            <CheckCircle2 size={52} />
            <h2>Transfer simulated successfully</h2>
            <p>
              No money moved. This portfolio workflow updated the demo balance and activity locally.
            </p>
            <strong>Reference: {result.reference}</strong>
            <div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setStep(1);
                  setAmount('');
                  setNote('');
                }}
              >
                Make another transfer
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/')}>
                Dashboard
              </button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
