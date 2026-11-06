import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chatbot from './Chatbot';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    chat: vi.fn(),
    conversations: vi.fn(),
    createConversation: vi.fn(),
    conversationMessages: vi.fn(),
    deleteConversation: vi.fn(),
  },
}));

// vite.config.js sets restoreMocks, which resets mock implementations before each
// test, so default resolved values must be re-armed here rather than in vi.mock().
beforeEach(() => {
  api.conversations.mockResolvedValue([]);
  api.createConversation.mockResolvedValue({ id: 'conversation-test' });
  api.conversationMessages.mockResolvedValue([]);
  api.deleteConversation.mockResolvedValue({ status: 'deleted' });
});

describe('Chatbot', () => {
  it('renders a friendly fallback instead of crashing when the API is unavailable', async () => {
    api.chat.mockRejectedValue(
      new Error(
        'Cannot connect to the demo API. Start the Flask backend at http://127.0.0.1:5000.',
      ),
    );
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open banking assistant' }));
    fireEvent.click(screen.getByRole('button', { name: 'What is my current balance?' }));
    await waitFor(() => expect(screen.getByText(/Start the Flask backend/)).toBeInTheDocument());
  });

  it('shows the assistant reply after a successful request', async () => {
    api.chat.mockResolvedValue({ reply: 'Your demo balance is $100.00.', aiGenerated: true });
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open banking assistant' }));
    fireEvent.click(screen.getByRole('button', { name: 'What is my current balance?' }));
    await waitFor(() =>
      expect(screen.getByText('Your demo balance is $100.00.')).toBeInTheDocument(),
    );
  });

  it('opens when the Assistant page asks for it', () => {
    render(<Chatbot />);
    expect(screen.queryByRole('region', { name: 'Banking assistant' })).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('open-chat'));
    });
    expect(screen.getByRole('region', { name: 'Banking assistant' })).toBeInTheDocument();
  });
});
