import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, EmptyState, PageHeader, StatusBadge, TransactionItem } from '../components/UI';
import { date, money } from '../utils/format';
export default function Transactions() {
  const { transactions, preferences } = useApp();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [category, setCategory] = useState('All');
  const [type, setType] = useState('All');
  const [sort, setSort] = useState('newest');
  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);
  const categories = ['All', ...new Set(transactions.map((t) => t.category))];
  const filtered = useMemo(
    () =>
      transactions
        .filter(
          (t) =>
            (!search || `${t.description} ${t.id}`.toLowerCase().includes(search.toLowerCase())) &&
            (category === 'All' || t.category === category) &&
            (type === 'All' || t.type === type),
        )
        .sort((a, b) =>
          sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
        ),
    [transactions, search, category, type, sort],
  );
  return (
    <>
      <PageHeader
        title="Transactions"
        description="Search, filter and review your simulated account activity."
      />
      <Card className={preferences.compact ? 'transactions-compact' : ''}>
        <div className="filters">
          <label className="search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions…"
            />
          </label>
          <label>
            <Filter size={16} />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <SlidersHorizontal size={16} />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="All">All types</option>
              <option value="credit">Credits</option>
              <option value="debit">Debits</option>
            </select>
          </label>
          <label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
        <div className="desktop-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>{date(t.date)}</td>
                  <td>
                    <strong>{t.description}</strong>
                    <small>{t.id}</small>
                  </td>
                  <td>{t.category}</td>
                  <td>{t.type}</td>
                  <td className={t.type === 'credit' ? 'positive' : 'negative'}>
                    {t.type === 'credit' ? '+' : ''}
                    {money(t.amount)}
                  </td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-transactions">
          {filtered.map((t) => (
            <TransactionItem key={t.id} transaction={t} />
          ))}
        </div>
        {filtered.length === 0 && (
          <EmptyState
            title="No matching transactions"
            message="Try a different search or filter."
          />
        )}
      </Card>
    </>
  );
}
