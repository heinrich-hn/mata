import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">404 — Not Found</h1>
        <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
        <Link
          to="/alerts"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Go to Alert Feed
        </Link>
      </div>
    </div>
  );
}
