"use client";

import { useState } from "react";
import { Settings, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { vexaAPI } from "@/lib/api";
import { AdminGuard } from "@/components/admin/admin-guard";

function SettingsContent() {
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus("unknown");
    setConnectionError(null);

    try {
      const result = await vexaAPI.testConnection();
      if (result.success) {
        setConnectionStatus("connected");
        toast.success("Connection successful", {
          description: "Successfully connected to Vexa API",
        });
      } else {
        setConnectionStatus("error");
        setConnectionError(result.error || "Unknown error");
        toast.error("Connection failed", {
          description: result.error,
        });
      }
    } catch (error) {
      setConnectionStatus("error");
      setConnectionError((error as Error).message);
      toast.error("Connection failed", {
        description: (error as Error).message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Vexa Dashboard connection
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Vexa API Configuration
            </CardTitle>
            <CardDescription>
              Configure the connection to your Vexa instance. These settings are managed via environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API URL */}
            <div className="space-y-2">
              <Label htmlFor="apiUrl">API URL</Label>
              <Input
                id="apiUrl"
                value={process.env.NEXT_PUBLIC_VEXA_API_URL || "http://localhost:18056"}
                disabled
                className="font-mono bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Set via <code className="bg-muted px-1 rounded">VEXA_API_URL</code> environment variable
              </p>
            </div>

            {/* WebSocket URL */}
            <div className="space-y-2">
              <Label htmlFor="wsUrl">WebSocket URL</Label>
              <Input
                id="wsUrl"
                value={process.env.NEXT_PUBLIC_VEXA_WS_URL || "ws://localhost:18056/ws"}
                disabled
                className="font-mono bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Set via <code className="bg-muted px-1 rounded">NEXT_PUBLIC_VEXA_WS_URL</code> environment variable
              </p>
            </div>

            {/* API Key Status */}
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value="••••••••••••••••••••••••••••••••"
                  disabled
                  className="font-mono bg-muted"
                />
                <Badge variant="secondary">Configured</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Set via <code className="bg-muted px-1 rounded">VEXA_API_KEY</code> environment variable
              </p>
            </div>

            <Separator />

            {/* Test Connection */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Connection Status</p>
                <div className="flex items-center gap-2">
                  {connectionStatus === "connected" && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Connected</span>
                    </>
                  )}
                  {connectionStatus === "error" && (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">
                        {connectionError || "Connection failed"}
                      </span>
                    </>
                  )}
                  {connectionStatus === "unknown" && (
                    <span className="text-sm text-muted-foreground">Not tested</span>
                  )}
                </div>
              </div>
              <Button onClick={handleTestConnection} disabled={isTesting}>
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Environment Variables */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>
              To configure the dashboard, create a <code className="bg-muted px-1 rounded">.env.local</code> file with these variables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`# Vexa API Configuration
VEXA_API_URL=http://localhost:18056
VEXA_API_KEY=your_api_key_here

# WebSocket URL (public, visible client-side)
NEXT_PUBLIC_VEXA_WS_URL=ws://localhost:18056/ws`}
            </pre>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Vexa Dashboard is an open source web interface for Vexa, the self-hosted meeting transcription API.
              </p>
              <div className="flex gap-4">
                <a
                  href="https://github.com/Vexa-ai/vexa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Vexa GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://vexa.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Vexa Website
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AdminGuard>
      <SettingsContent />
    </AdminGuard>
  );
}
