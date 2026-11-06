const DEFAULT_BASE_URL = 'http://127.0.0.1:5000/api';
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 10000;
const TOKEN_KEY = 'finoraAuthToken';
export const SESSION_EXPIRED_EVENT = 'finora:session-expired';

export function getAuthToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
export function setAuthToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Storage may be unavailable. */
  }
}

export async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
  try {
    const token = getAuthToken();
    const response = await fetch(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : {};
    if (!response.ok) {
      // A 401 on a protected call means the stored session expired or was revoked. Tell the app
      // so it can return to the sign-in screen instead of leaving every page showing errors.
      // Failed sign-in/sign-up attempts also return 401/4xx but must not trigger this.
      const isAuthAttempt = /^\/?auth\/(login|register)\b/.test(path);
      if (response.status === 401 && token && !isAuthAttempt) {
        setAuthToken('');
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      const error = new Error(payload.error || `Request failed (${response.status}).`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      if (externalSignal?.aborted && !timedOut) throw error;
      throw new Error('The request timed out. Check the backend and try again.');
    }
    if (error instanceof TypeError)
      throw new Error(
        'Cannot connect to the demo API. Start the Flask backend at http://127.0.0.1:5000.',
      );
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

export const api = {
  register: (data) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  me: () => apiRequest('/auth/me'),
  health: () => apiRequest('/health'),
  accounts: () => apiRequest('/accounts'),
  transactions: () => apiRequest('/transactions'),
  beneficiaries: () => apiRequest('/beneficiaries'),
  cards: () => apiRequest('/cards'),
  notifications: () => apiRequest('/notifications'),
  createBeneficiary: (data) =>
    apiRequest('/beneficiaries', { method: 'POST', body: JSON.stringify(data) }),
  updateBeneficiary: (id, data) =>
    apiRequest(`/beneficiaries/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  conversations: () => apiRequest('/conversations'),
  createConversation: (title = 'New conversation') =>
    apiRequest('/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
  conversationMessages: (id) => apiRequest(`/conversations/${encodeURIComponent(id)}/messages`),
  deleteConversation: (id) =>
    apiRequest(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  transfer: async (data) => {
    const result = await apiRequest('/transfers', { method: 'POST', body: JSON.stringify(data) });
    if (result?.status !== 'simulated' || typeof result.reference !== 'string')
      throw new Error(
        'The demo API returned an unexpected transfer response. No local changes were made.',
      );
    return result;
  },
  billPayment: async (data) => {
    const result = await apiRequest('/bill-payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (result?.status !== 'simulated' || typeof result.reference !== 'string')
      throw new Error(
        'The demo API returned an unexpected bill-payment response. No local changes were made.',
      );
    return result;
  },
  chat: (message, conversationId, options = {}) =>
    apiRequest('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId }),
      ...options,
    }),
};
