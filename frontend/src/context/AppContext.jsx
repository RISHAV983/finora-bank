import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  accounts as initialAccounts,
  cards as initialCards,
  notifications as initialNotifications,
  transactions as initialTransactions,
  beneficiaries as initialBeneficiaries,
} from '../data/mockData';
import { api, getAuthToken, setAuthToken, SESSION_EXPIRED_EVENT } from '../services/api';
const AppContext = createContext(null);
const PREFERENCES_KEY = 'finoraPreferences';
const DEFAULT_PREFERENCES = { notifications: true, compact: false, security: true };
function readStoredJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
function writeStoredJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage may be unavailable. */
  }
}
function readPreferences() {
  const stored = readStoredJson(PREFERENCES_KEY, {});
  const candidate = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_PREFERENCES).map(([key, fallback]) => [
      key,
      typeof candidate[key] === 'boolean' ? candidate[key] : fallback,
    ]),
  );
}
export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [beneficiaries, setBeneficiaries] = useState(initialBeneficiaries);
  const [cards, setCards] = useState(initialCards);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [preferences, setPreferences] = useState(readPreferences);
  // Demo banking state lives in the browser. Reset it whenever the signed-in user changes so one
  // person's transfers, frozen cards and read notifications never carry over to the next sign-in.
  const resetDemoState = useCallback(() => {
    setAccounts(initialAccounts);
    setTransactions(initialTransactions);
    setBeneficiaries(initialBeneficiaries);
    setCards(initialCards);
    setNotifications(initialNotifications);
  }, []);
  useEffect(() => {
    let active = true;
    if (!getAuthToken()) {
      setAuthReady(true);
      return () => {
        active = false;
      };
    }
    api
      .me()
      .then(({ user: current }) => {
        if (active) setUser(current);
      })
      .catch(() => {
        setAuthToken('');
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    function onSessionExpired() {
      setUser(null);
      resetDemoState();
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [resetDemoState]);
  // Beneficiaries are stored server-side so a newly added recipient is a valid transfer target.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    api
      .beneficiaries()
      .then((items) => {
        if (active && Array.isArray(items)) setBeneficiaries(items);
      })
      .catch(() => {
        /* Keep the built-in demo recipients if the list cannot be loaded. */
      });
    return () => {
      active = false;
    };
  }, [userId]);
  const login = useCallback(
    async (email, password) => {
      const result = await api.login({ email, password });
      resetDemoState();
      setAuthToken(result.token);
      setUser(result.user);
      return result.user;
    },
    [resetDemoState],
  );
  const register = useCallback(
    async (name, email, password) => {
      const result = await api.register({ name, email, password });
      resetDemoState();
      setAuthToken(result.token);
      setUser(result.user);
      return result.user;
    },
    [resetDemoState],
  );
  const logout = useCallback(async () => {
    try {
      if (getAuthToken()) await api.logout();
    } catch {
      /* The session is cleared locally even if the server could not be reached. */
    } finally {
      setAuthToken('');
      setUser(null);
      resetDemoState();
    }
  }, [resetDemoState]);
  const toggleCard = useCallback(
    (id) =>
      setCards((items) =>
        items.map((card) =>
          card.id === id
            ? { ...card, frozen: !card.frozen, status: card.frozen ? 'Active' : 'Frozen' }
            : card,
        ),
      ),
    [],
  );
  const markRead = useCallback(
    (id) => setNotifications((items) => items.map((n) => (n.id === id ? { ...n, read: true } : n))),
    [],
  );
  const addTransaction = useCallback(
    (transaction) => setTransactions((items) => [transaction, ...items]),
    [],
  );
  const updateAccountBalance = useCallback((id, delta) => {
    const cents = Math.round(delta * 100);
    setAccounts((items) =>
      items.map((account) =>
        account.id !== id
          ? account
          : {
              ...account,
              balance: Math.round((account.balance + cents / 100) * 100) / 100,
              available: Math.round((account.available + cents / 100) * 100) / 100,
            },
      ),
    );
  }, []);
  const saveBeneficiary = useCallback(async ({ id, name, bank, lastFour }) => {
    const payload = { name, bank, lastFour };
    const saved = id
      ? await api.updateBeneficiary(id, payload)
      : await api.createBeneficiary(payload);
    setBeneficiaries((items) =>
      id ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved],
    );
    return saved;
  }, []);
  const updatePreference = useCallback(
    (key, checked) => setPreferences((current) => ({ ...current, [key]: checked })),
    [],
  );
  useEffect(() => {
    writeStoredJson(PREFERENCES_KEY, preferences);
  }, [preferences]);
  const value = useMemo(
    () => ({
      user,
      authReady,
      accounts,
      transactions,
      beneficiaries,
      cards,
      notifications,
      preferences,
      login,
      register,
      logout,
      toggleCard,
      markRead,
      addTransaction,
      updateAccountBalance,
      saveBeneficiary,
      updatePreference,
    }),
    [
      user,
      authReady,
      accounts,
      transactions,
      beneficiaries,
      cards,
      notifications,
      preferences,
      login,
      register,
      logout,
      toggleCard,
      markRead,
      addTransaction,
      updateAccountBalance,
      saveBeneficiary,
      updatePreference,
    ],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export const useApp = () => useContext(AppContext);
