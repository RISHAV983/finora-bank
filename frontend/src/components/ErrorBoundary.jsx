import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // In a production app, forward this to an approved monitoring service.
    console.error('Finora UI error:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary" role="alert">
          <div className="error-boundary-card">
            <AlertTriangle size={30} aria-hidden="true" />
            <h1>Something went wrong</h1>
            <p>
              The demo screen hit an unexpected error. Your real banking information is not
              connected to this app.
            </p>
            <button type="button" className="btn btn-primary" onClick={this.reset}>
              <RefreshCw size={15} /> Reload application
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
