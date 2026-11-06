import { Link } from 'react-router-dom';
import { Card } from '../components/UI';
export default function NotFound() {
  return (
    <div className="center-page">
      <Card>
        <span className="eyebrow">404</span>
        <h1>Page not found</h1>
        <p>The page you requested does not exist in this demo.</p>
        <Link className="btn btn-primary" to="/">
          Return to dashboard
        </Link>
      </Card>
    </div>
  );
}
