import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useApp } from './context/AppContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import AccountDetails from './pages/AccountDetails';
import Transactions from './pages/Transactions';
import Transfer from './pages/Transfer';
import Bills from './pages/Bills';
import Beneficiaries from './pages/Beneficiaries';
import Cards from './pages/Cards';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Assistant from './pages/Assistant';
import NotFound from './pages/NotFound';
function Protected() {
  const { user, authReady } = useApp();
  return !authReady ? null : user ? <Outlet /> : <Navigate to="/login" replace />;
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="accounts/:id" element={<AccountDetails />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="transfer" element={<Transfer />} />
          <Route path="bills" element={<Bills />} />
          <Route path="beneficiaries" element={<Beneficiaries />} />
          <Route path="cards" element={<Cards />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="assistant" element={<Assistant />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
