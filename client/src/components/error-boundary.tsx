import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error strictly in React rendering:", error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full flex items-center justify-center p-4 bg-muted/30">
                    <Card className="w-full max-w-md shadow-lg border-destructive/20">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                            </div>
                            <CardTitle className="text-xl">Something went wrong</CardTitle>
                            <CardDescription>
                                A rendering error occurred while trying to display this interface.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm bg-muted rounded-md p-3 overflow-auto max-h-32 text-muted-foreground font-mono">
                                {this.state.error?.message || "Unknown rendering error."}
                            </div>
                        </CardContent>
                        <CardFooter className="flex gap-2 justify-center">
                            <Button onClick={this.handleReload} variant="default" className="w-full">
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Reload Page
                            </Button>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/">
                                    <Home className="mr-2 h-4 w-4" />
                                    Dashboard
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
