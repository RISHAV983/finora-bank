import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Dashboard from './Dashboard';
import { AppProvider } from '../context/AppContext';

describe('Dashboard', () => {
  // Regression: a typo in the spending-by-category reduce threw a ReferenceError on every render.
  it('renders the snapshot and spending breakdown without crashing', () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <Dashboard />
        </AppProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Your financial snapshot')).toBeInTheDocument();
    expect(screen.getAllByText(/Groceries/).length).toBeGreaterThan(0);
    // No hardcoded persona: the greeting must not name anyone who is not signed in.
    expect(screen.queryByText(/Alex/)).not.toBeInTheDocument();
  });
});
