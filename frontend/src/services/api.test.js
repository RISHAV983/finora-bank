import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, apiRequest, setAuthToken, getAuthToken, SESSION_EXPIRED_EVENT } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('returns JSON for a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ status: 'ok' }),
      }),
    );
    await expect(apiRequest('/health')).resolves.toEqual({ status: 'ok' });
  });

  it('surfaces a useful backend validation message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: 'Message is required.' }),
      }),
    );
    await expect(apiRequest('/chat')).rejects.toThrow('Message is required.');
  });

  it('does not accept a malformed simulated transfer response as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'Unexpected response' }),
      }),
    );
    await expect(api.transfer({ amount: 10 })).rejects.toThrow('unexpected transfer response');
  });

  it('explains a connection failure in beginner-friendly language', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiRequest('/health')).rejects.toThrow('Start the Flask backend');
  });

  const unauthorized = () =>
    vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Your session is invalid or expired. Please sign in again.' }),
    });

  it('clears the token and announces an expired session on a protected 401', async () => {
    setAuthToken('stale-token');
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    vi.stubGlobal('fetch', unauthorized());
    await expect(apiRequest('/accounts')).rejects.toThrow('session is invalid or expired');
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getAuthToken()).toBe('');
  });

  it('does not treat a wrong password on sign-in as an expired session', async () => {
    setAuthToken('existing-token');
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    vi.stubGlobal('fetch', unauthorized());
    await expect(apiRequest('/auth/login', { method: 'POST', body: '{}' })).rejects.toThrow();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
    expect(getAuthToken()).toBe('existing-token');
    setAuthToken('');
  });

  it('sends beneficiary saves to the matching endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({ id: 'ben-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await api.createBeneficiary({ name: 'N', bank: 'B', lastFour: '1234' });
    await api.updateBeneficiary('ben 1', { name: 'N', bank: 'B', lastFour: '1234' });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/beneficiaries$/);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/beneficiaries\/ben%201$/);
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
  });
});
