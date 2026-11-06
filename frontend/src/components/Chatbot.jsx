import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { api } from '../services/api';

const suggestions = [
  'What is my current balance?',
  'Show my recent transactions',
  'How do I transfer money?',
  'How can I block my card?',
  'What are my upcoming payments?',
  'Where can I find my account details?',
];
const welcomeMessage = {
  role: 'assistant',
  text: 'Hi! I’m Finora AI Assistant. Ask me about the fictional demo accounts, transactions, or how to use this app. AI answers can be incorrect; no real banking actions are available.',
  time: new Date().toISOString(),
};

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Effects must be synchronous; React expects a cleanup function or nothing.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, typing]);

  // The "Open assistant" button on the Assistant page announces itself with this window event.
  useEffect(() => {
    const openFromPage = () => setOpen(true);
    window.addEventListener('open-chat', openFromPage);
    return () => window.removeEventListener('open-chat', openFromPage);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setHistoryLoading(true);
      api
        .conversations()
        .then((items) => setConversations(items))
        .catch((error) => console.error('Unable to load saved conversations:', error))
        .finally(() => setHistoryLoading(false));
    }
  }, [open]);

  async function send(text = input) {
    const value = text.trim();
    if (!value || typing) return;

    setInput('');
    setMessages((current) => [
      ...current,
      { role: 'user', text: value, time: new Date().toISOString() },
    ]);
    setTyping(true);
    try {
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const created = await api.createConversation(value.slice(0, 60));
        activeConversationId = created.id;
        setConversationId(activeConversationId);
      }
      const data = await api.chat(value, activeConversationId);
      if (data?.aiGenerated !== true && data?.testProvider !== true) {
        throw new Error(
          'The backend did not confirm an AI-generated response. Check the server configuration.',
        );
      }
      setAiUnavailable(false);
      setConversations(await api.conversations());
      const reply =
        typeof data?.reply === 'string' && data.reply.trim()
          ? data.reply
          : 'The AI assistant returned an empty response. Please try again.';
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: reply,
          time: new Date().toISOString(),
          aiGenerated: data.aiGenerated === true,
          testProvider: data.testProvider === true,
        },
      ]);
    } catch (error) {
      console.error('Finora chatbot request failed:', error);
      setAiUnavailable(true);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text:
            error.message ||
            'The AI assistant is unavailable. Check the Flask backend and LLM configuration, then retry.',
          time: new Date().toISOString(),
          error: true,
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([
      {
        role: 'assistant',
        text: 'New conversation started. I’m an AI assistant for fictional demo data; answers can be incorrect and no real banking actions are available.',
        time: new Date().toISOString(),
      },
    ]);
    setAiUnavailable(false);
  }

  async function clearConversation() {
    try {
      if (conversationId) await api.deleteConversation(conversationId);
      setConversations(await api.conversations());
      startNewConversation();
    } catch (error) {
      console.error('Unable to delete conversation:', error);
    }
  }

  async function openConversation(id) {
    try {
      const saved = await api.conversationMessages(id);
      setConversationId(id);
      setMessages(
        saved.map((item) => ({
          role: item.role,
          text: item.content,
          time: item.createdAt,
          aiGenerated: item.role === 'assistant',
        })),
      );
    } catch (error) {
      setAiUnavailable(true);
      console.error('Unable to open conversation:', error);
    }
  }

  return (
    <>
      {open && (
        <section
          className="chat-window"
          aria-label="Banking assistant"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          <div className="chat-head">
            <div>
              <strong>
                <Bot size={18} aria-hidden="true" /> Finora AI Assistant
              </strong>
              <small>
                {aiUnavailable
                  ? 'AI service unavailable · check configuration'
                  : messages.some((item) => item.testProvider)
                    ? 'Automated test provider · not AI'
                    : 'AI-generated answers · fictional demo only'}
              </small>
            </div>
            <div>
              <select
                aria-label="Previous conversations"
                value={conversationId || ''}
                onChange={(event) =>
                  event.target.value ? openConversation(event.target.value) : startNewConversation()
                }
                disabled={historyLoading || typing}
                style={{ maxWidth: '125px' }}
              >
                <option value="">New chat</option>
                {conversations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="chat-icon"
                onClick={clearConversation}
                aria-label="Delete conversation"
                title="Delete conversation"
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                className="chat-icon"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                <X size={17} />
              </button>
            </div>
          </div>
          <div
            className="chat-messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Conversation"
          >
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`bubble-row ${message.role}`}>
                <div className={`bubble${message.error ? ' bubble-error' : ''}`}>
                  {message.text}
                  <time dateTime={message.time || undefined}>
                    {new Date(message.time || Date.now()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              </div>
            ))}
            {typing && (
              <div className="bubble-row assistant">
                <div className="bubble typing" aria-label="Assistant is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          {messages.length === 1 && (
            <div className="suggestions" aria-label="Suggested questions">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  disabled={typing}
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a question…"
              aria-label="Message assistant"
              autoComplete="off"
              maxLength={500}
              disabled={typing}
            />
            <button type="submit" aria-label="Send message" disabled={typing || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Close banking assistant' : 'Open banking assistant'}
        aria-expanded={open}
      >
        {open ? <X /> : <MessageCircle />}
      </button>
    </>
  );
}
