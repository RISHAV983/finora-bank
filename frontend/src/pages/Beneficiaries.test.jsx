import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Beneficiaries from './Beneficiaries';
import { AppProvider } from '../context/AppContext';
import { api } from '../services/api';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: { ...actual.api, createBeneficiary: vi.fn(), updateBeneficiary: vi.fn() },
  };
});

beforeEach(() => {
  // restoreMocks (vite.config.js) clears implementations before every test, so arm them here.
  api.createBeneficiary.mockImplementation(async ({ name, bank, lastFour }) => ({
    id: 'ben-server01',
    name,
    bank,
    account: `•••• ${lastFour}`,
  }));
  api.updateBeneficiary.mockImplementation(async (id, { name, bank, lastFour }) => ({
    id,
    name,
    bank,
    account: `•••• ${lastFour}`,
  }));
});
afterEach(() => window.localStorage.clear());

function fillForm({ name = 'Taylor Reed', bank = 'Example Bank', lastFour = '2048' } = {}) {
  fireEvent.change(screen.getByLabelText('Recipient name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Bank name'), { target: { value: bank } });
  fireEvent.change(screen.getByLabelText('Last four digits of demo account'), {
    target: { value: lastFour },
  });
}

describe('Beneficiaries', () => {
  it('adds a beneficiary using only the last four demo account digits', async () => {
    render(
      <AppProvider>
        <Beneficiaries />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add beneficiary' }));
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save demo details' }));
    expect(await screen.findByText('Taylor Reed')).toBeInTheDocument();
    expect(screen.getByText('•••• 2048')).toBeInTheDocument();
    expect(api.createBeneficiary).toHaveBeenCalledWith({
      name: 'Taylor Reed',
      bank: 'Example Bank',
      lastFour: '2048',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('rejects account suffixes that are not four digits', async () => {
    render(
      <AppProvider>
        <Beneficiaries />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add beneficiary' }));
    fillForm({ lastFour: '12' });
    fireEvent.click(screen.getByRole('button', { name: 'Save demo details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('last four digits');
    expect(api.createBeneficiary).not.toHaveBeenCalled();
  });

  it('keeps the form open and explains the problem when the server rejects the save', async () => {
    api.createBeneficiary.mockRejectedValue(new Error('You can save up to 50 demo beneficiaries.'));
    render(
      <AppProvider>
        <Beneficiaries />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add beneficiary' }));
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save demo details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('up to 50');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Taylor Reed')).not.toBeInTheDocument();
  });

  it('edits an existing beneficiary through the API', async () => {
    render(
      <AppProvider>
        <Beneficiaries />
      </AppProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit details' })[0]);
    fillForm({ name: 'Ava Renamed', bank: 'Northstar Bank', lastFour: '7732' });
    fireEvent.click(screen.getByRole('button', { name: 'Save demo details' }));
    expect(await screen.findByText('Ava Renamed')).toBeInTheDocument();
    expect(api.updateBeneficiary).toHaveBeenCalledWith('ben-1', {
      name: 'Ava Renamed',
      bank: 'Northstar Bank',
      lastFour: '7732',
    });
  });
});
