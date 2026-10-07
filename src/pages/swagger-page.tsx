import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { Button } from "../components/ui/button";

export function SwaggerPage() {
  const specUrl = new URL(`${import.meta.env.BASE_URL}openapi.yaml`, window.location.origin).toString();
  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-white px-4 sm:px-6">
        <Button asChild variant="secondary" size="sm"><Link to="/"><ArrowLeft className="size-4" />Portal</Link></Button>
        <div><span className="font-semibold">Lab4 KPIs</span><span className="ml-2 text-sm text-muted-foreground">API v1</span></div>
      </header>
      <div className="mx-auto max-w-7xl px-2 py-4 sm:px-6">
        <SwaggerUI url={specUrl} deepLinking displayRequestDuration tryItOutEnabled persistAuthorization={false} />
      </div>
    </main>
  );
}
