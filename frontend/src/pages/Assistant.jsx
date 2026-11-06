import { Bot, MessageCircle } from 'lucide-react';
import { PageHeader, Card } from '../components/UI';

export default function Assistant() {
  return (
    <>
      <PageHeader
        title="AI Banking Assistant"
        description="Ask questions in natural language about the fictional Finora demo."
      />
      <Card className="assistant-page">
        <div className="assistant-icon">
          <Bot size={32} />
        </div>
        <h2>Ask Finora AI Assistant</h2>
        <p>
          The assistant uses a configured language-model API through the Flask backend. Answers may
          be incorrect and use fictional demo data only. It cannot perform real transfers, pay
          bills, or change cards.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => window.dispatchEvent(new Event('open-chat'))}
        >
          <MessageCircle size={17} /> Open assistant
        </button>
      </Card>
    </>
  );
}
