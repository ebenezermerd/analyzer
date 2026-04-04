"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Card className="glass border-red-500/20 max-w-lg mx-auto mt-20">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <div>
              <h2 className="font-heading text-xl font-light mb-1">Something went wrong</h2>
              <p className="text-xs text-muted-foreground">{this.state.error?.message}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Try again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
