import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from './AppContext';
import { api, SESSION_EXPIRED_EVENT, getAuthToken } from '../services/api';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      ...actual.api,
      login: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
      beneficiaries: vi.fn(),
    },
  };
});

function ContextProbe() {
  const {
    user,
    preferences,
    updatePreference,
    transactions,
    accounts,
    beneficiaries,
    login,
    logout,
    addTransaction,
    updateAccountBalance,
  } = useApp();
  return (
    <div>
      <span>{user ? user.email : 'signed out'}</span>
      <span>{preferences.compact ? 'compact on' : 'compact off'}</span>
      <span data-testid="tx-count">{transactions.length}</span>
      <span data-testid="checking">{accounts[0].balance}</span>
      <span data-testid="beneficiaries">{beneficiaries.map((b) => b.name).join('|')}</span>
      <button type="button" onClick={() => updatePreference('compact', true)}>
        Enable compact
      </button>
      <button type="button" onClick={() => login('a@example.test', 'password-123')}>
        Sign in
      </button>
      <button type="button" onClick={() => logout()}>
        Sign out
      </button>
      <button
        type="button"
        onClick={() => {
          addTransaction({ id: 'TX-LOCAL', description: 'Local', amount: -5, type: 'debit' });
          updateAccountBalance(accounts[0].id, -5);
        }}
      >
        Spend
      </button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <AppProvider>
      <ContextProbe />
    </AppProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  api.login.mockResolvedValue({
    token: 'tok-1',
    user: { id: 1, name: 'A', email: 'a@example.test' },
  });
  api.logout.mockResolvedValue({ status: 'logged_out' });
  api.beneficiaries.mockResolvedValue([
    { id: 'ben-1', name: 'Server Person', bank: 'B', account: '•••• 1111' },
  ]);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('AppProvider resilience', () => {
  it('starts signed out when no server-issued authentication token exists', () => {
    renderProbe();
    expect(screen.getByText('signed out')).toBeInTheDocument();
  });

  it('persists demo preferences for the next visit', async () => {
    renderProbe();
    screen.getByRole('button', { name: 'Enable compact' }).click();
    expect(await screen.findByText('compact on')).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('finoraPreferences')).compact).toBe(true),
    );
  });
});

describe('AppProvider demo state per user', () => {
  it('does not carry transfers or balances over to the next sign-in', async () => {
    renderProbe();
    const initialCount = screen.getByTestId('tx-count').textContent;
    const initialBalance = screen.getByTestId('checking').textContent;

    await act(async () => screen.getByRole('button', { name: 'Sign in' }).click());
    expect(await screen.findByText('a@example.test')).toBeInTheDocument();
    await act(async () => screen.getByRole('button', { name: 'Spend' }).click());
    expect(screen.getByTestId('tx-count').textContent).not.toBe(initialCount);
    expect(screen.getByTestId('checking').textContent).not.toBe(initialBalance);

    await act(async () => screen.getByRole('button', { name: 'Sign out' }).click());
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(screen.getByTestId('tx-count').textContent).toBe(initialCount);
    expect(screen.getByTestId('checking').textContent).toBe(initialBalance);
  });

  it("loads the signed-in user's beneficiaries from the server", async () => {
    renderProbe();
    await act(async () => screen.getByRole('button', { name: 'Sign in' }).click());
    await waitFor(() =>
      expect(screen.getByTestId('beneficiaries').textContent).toBe('Server Person'),
    );
  });

  it('returns to a signed-out state when the session expires', async () => {
    renderProbe();
    await act(async () => screen.getByRole('button', { name: 'Sign in' }).click());
    expect(await screen.findByText('a@example.test')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });
    expect(await screen.findByText('signed out')).toBeInTheDocument();
  });

  it('still signs the user out locally when the logout request fails', async () => {
    api.logout.mockRejectedValue(new Error('Cannot connect to the demo API.'));
    renderProbe();
    await act(async () => screen.getByRole('button', { name: 'Sign in' }).click());
    expect(await screen.findByText('a@example.test')).toBeInTheDocument();
    await act(async () => screen.getByRole('button', { name: 'Sign out' }).click());
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(getAuthToken()).toBe('');
  });
});
