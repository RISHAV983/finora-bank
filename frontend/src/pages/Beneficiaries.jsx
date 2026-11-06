import { Plus, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, PageHeader } from '../components/UI';

const emptyForm = { name: '', bank: '', lastFour: '' };

export default function Beneficiaries() {
  const { beneficiaries, saveBeneficiary } = useApp();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setEditing(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing]);

  function openForm(beneficiary = null) {
    setEditing(beneficiary || {});
    setForm(
      beneficiary
        ? {
            name: beneficiary.name,
            bank: beneficiary.bank,
            lastFour: beneficiary.account.replace(/\D/g, '').slice(-4),
          }
        : emptyForm,
    );
    setError('');
  }

  function closeForm() {
    setEditing(null);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    const bank = form.bank.trim();
    const lastFour = form.lastFour.trim();
    if (name.length < 2 || name.length > 80)
      return setError('Enter a name between 2 and 80 characters.');
    if (bank.length < 2 || bank.length > 80)
      return setError('Enter a bank name between 2 and 80 characters.');
    if (!/^\d{4}$/.test(lastFour))
      return setError('Enter only the last four digits of the demo account.');

    setSaving(true);
    setError('');
    try {
      await saveBeneficiary({ ...(editing.id ? { id: editing.id } : {}), name, bank, lastFour });
      closeForm();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this beneficiary. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Beneficiaries"
        description="Recipients available for your simulated transfers."
        action={
          <button type="button" className="btn btn-primary" onClick={() => openForm()}>
            <Plus size={17} aria-hidden="true" /> Add beneficiary
          </button>
        }
      />
      <div className="beneficiary-grid">
        {beneficiaries.map((beneficiary) => (
          <Card key={beneficiary.id}>
            <div className="beneficiary">
              <div className="avatar large">
                <UserRound size={21} aria-hidden="true" />
              </div>
              <div>
                <h2>{beneficiary.name}</h2>
                <span>{beneficiary.bank}</span>
                <small>{beneficiary.account}</small>
              </div>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => openForm(beneficiary)}>
              Edit details
            </button>
          </Card>
        ))}
      </div>
      {editing && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="beneficiary-dialog-title"
          >
            <div className="section-head">
              <div>
                <h2 id="beneficiary-dialog-title">
                  {editing.id ? 'Edit demo beneficiary' : 'Add demo beneficiary'}
                </h2>
                <p>Only fictional details are stored with your demo account.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={closeForm}
                aria-label="Close beneficiary form"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={submit}>
              <label>
                Recipient name
                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Bank name
                <input
                  value={form.bank}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, bank: event.target.value }))
                  }
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Last four digits of demo account
                <input
                  value={form.lastFour}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lastFour: event.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="1234"
                  maxLength={4}
                  required
                  aria-describedby="beneficiary-account-help"
                />
              </label>
              <small id="beneficiary-account-help">
                Do not enter a real account number or any banking credentials.
              </small>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save demo details'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
