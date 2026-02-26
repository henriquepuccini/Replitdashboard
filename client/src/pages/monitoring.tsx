import { useState } from "react";
import { format } from "date-fns";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Download,
    ShieldAlert,
    Settings
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { exportToCsv } from "@/lib/export-utils";
import { useConnectors } from "@/hooks/use-connectors";
import {
    useConnectorMetrics,
    useConnectorSlas,
    useUpdateConnectorSla,
    useIntegrationAlerts,
    useUpdateIntegrationAlert,
} from "@/hooks/use-monitoring";
import type { Connector, ConnectorSla, IntegrationAlert } from "@shared/schema";

// --- Subcomponents ---

function ConnectorHealthRow({ connector }: { connector: Connector }) {
    const { data: metrics } = useConnectorMetrics(connector.id, 20); // Last 20 runs for sparkline

    if (!metrics) {
        return (
            <TableRow>
                <TableCell className="font-medium">{connector.name}</TableCell>
                <TableCell colSpan={4} className="text-muted-foreground text-sm">Loading metrics...</TableCell>
            </TableRow>
        );
    }

    const latest = metrics[0];
    const avgLatency = metrics.length ? metrics.reduce((acc, m) => acc + m.durationMs, 0) / metrics.length : 0;
    const successCount = metrics.filter(m => m.status === 'success').length;
    const successRate = metrics.length ? (successCount / metrics.length) * 100 : 0;

    // Recharts expects data to go from old -> new for correct line rendering Left-to-Right
    const chartData = [...metrics].reverse().map((m, i) => ({ index: i, time: m.durationMs }));

    return (
        <TableRow>
            <TableCell className="font-medium">{connector.name}</TableCell>
            <TableCell>
                {latest ? (
                    <Badge variant={latest.status === 'success' ? 'default' : latest.status === 'failed' ? 'destructive' : 'secondary'}>
                        {latest.status}
                    </Badge>
                ) : <span className="text-muted-foreground text-sm">No runs</span>}
            </TableCell>
            <TableCell className="whitespace-nowrap">
                {latest ? format(new Date(latest.createdAt), "MMM d, HH:mm") : "-"}
            </TableCell>
            <TableCell>{avgLatency ? `${Math.round(avgLatency)}ms` : "-"}</TableCell>
            <TableCell>
                {metrics.length > 0 ? (
                    <div className="flex items-center gap-4">
                        <span className="w-12 text-right">{successRate.toFixed(0)}%</span>
                        <div className="h-8 w-24">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                                    <Line
                                        type="monotone"
                                        dataKey="time"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ) : "-"}
            </TableCell>
        </TableRow>
    );
}

function ConnectorHealthTab() {
    const { data: connectors = [], isLoading } = useConnectors();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Integrations Status</CardTitle>
                <CardDescription>Real-time view of connector health and performance metrics.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando conectores...</p>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Connector</TableHead>
                                    <TableHead>Latest Status</TableHead>
                                    <TableHead>Last Run</TableHead>
                                    <TableHead>Avg Latency</TableHead>
                                    <TableHead>Success Rate & Latency Trend</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {connectors.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                            No connectors found
                                        </TableCell>
                                    </TableRow>
                                )}
                                {connectors.map(c => (
                                    <ConnectorHealthRow key={c.id} connector={c} />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function AlertsInboxTab() {
    const { data: alerts = [], isLoading } = useIntegrationAlerts(100);
    const mutation = useUpdateIntegrationAlert();

    const handleAck = (id: string) => mutation.mutate({ id, status: "acknowledged" });
    const handleResolve = (id: string) => mutation.mutate({ id, status: "resolved" });

    const handleExport = () => {
        exportToCsv("alerts_export", alerts, [
            { label: "ID", key: "id" },
            { label: "Severity", key: "severity" },
            { label: "Status", key: "status" },
            { label: "Message", key: "message" },
            { label: "Type", key: "alertType" },
            { label: "Created At", key: "createdAt" },
        ]);
    };

    const getSeverityBadgeVariant = (severity: string) => {
        switch (severity) {
            case 'critical': return 'destructive';
            case 'warning': return 'secondary'; // fallback/custom logic if you have custom colors
            default: return 'outline';
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Alerts Inbox</CardTitle>
                    <CardDescription>Manage and acknowledge integration alerts from SLA monitoring.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={!alerts.length}>
                    <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando alertas...</p>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-24">Severity</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Detected At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {alerts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                            Inbox zero! No recent alerts.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {alerts.map(alert => (
                                    <TableRow key={alert.id} className={alert.status === 'open' ? "bg-muted/30" : ""}>
                                        <TableCell>
                                            <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                                                {alert.severity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-md truncate" title={alert.message}>
                                            {alert.message}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">{alert.status}</Badge>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {format(new Date(alert.createdAt), "MMM d, HH:mm")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {alert.status === "open" && (
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => handleAck(alert.id)}>
                                                        Ack
                                                    </Button>
                                                    <Button size="sm" onClick={() => handleResolve(alert.id)}>
                                                        Resolve
                                                    </Button>
                                                </div>
                                            )}
                                            {alert.status === "acknowledged" && (
                                                <Button size="sm" onClick={() => handleResolve(alert.id)}>
                                                    Resolve
                                                </Button>
                                            )}
                                            {alert.status === "resolved" && (
                                                <span className="text-xs text-muted-foreground">Resolved</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function SlaConfigRow({ connector, currentSla }: { connector: Connector, currentSla: ConnectorSla | undefined }) {
    const [open, setOpen] = useState(false);
    const mutation = useUpdateConnectorSla();

    const [maxLatency, setMaxLatency] = useState(currentSla?.maxLatencyMs?.toString() || "5000");
    const [successRate, setSuccessRate] = useState(currentSla?.successRateThreshold?.toString() || "95.00");
    const [emails, setEmails] = useState(currentSla?.escalationEmails?.join(", ") || "");

    const handleSave = () => {
        mutation.mutate({
            connectorId: connector.id,
            maxLatencyMs: parseInt(maxLatency, 10),
            successRateThreshold: parseFloat(successRate).toString(),
            escalationEmails: emails.split(",").map(e => e.trim()).filter(Boolean),
        }, {
            onSuccess: () => setOpen(false)
        });
    };

    return (
        <TableRow>
            <TableCell className="font-medium">{connector.name}</TableCell>
            <TableCell>{currentSla ? `${currentSla.maxLatencyMs}ms` : <span className="text-muted-foreground">Default (5000ms)</span>}</TableCell>
            <TableCell>{currentSla ? `${currentSla.successRateThreshold}%` : <span className="text-muted-foreground">Default (95.00%)</span>}</TableCell>
            <TableCell>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Settings className="w-4 h-4 mr-2" /> Configure
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Configure SLA - {connector.name}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="latency">Max Latency (ms)</Label>
                                <Input
                                    id="latency"
                                    type="number"
                                    value={maxLatency}
                                    onChange={(e) => setMaxLatency(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="successRate">Success Rate Threshold (%)</Label>
                                <Input
                                    id="successRate"
                                    type="number"
                                    step="0.01"
                                    value={successRate}
                                    onChange={(e) => setSuccessRate(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="emails">Escalation Emails (comma separated)</Label>
                                <Input
                                    id="emails"
                                    placeholder="admin@example.com, ops@example.com"
                                    value={emails}
                                    onChange={(e) => setEmails(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleSave} disabled={mutation.isPending}>
                                {mutation.isPending ? "Saving..." : "Save Configuration"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </TableCell>
        </TableRow>
    );
}

function SlaConfigTab() {
    const { data: connectors = [], isLoading: loadersC } = useConnectors();
    const { data: slas = [], isLoading: loadersS } = useConnectorSlas();

    const isLoading = loadersC || loadersS;

    return (
        <Card>
            <CardHeader>
                <CardTitle>SLA Configuration</CardTitle>
                <CardDescription>Manage thresholds and escalation contacts for each connector.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando configurações...</p>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Connector</TableHead>
                                    <TableHead>Max Latency</TableHead>
                                    <TableHead>Min Success Rate</TableHead>
                                    <TableHead className="w-32">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {connectors.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                            No connectors found
                                        </TableCell>
                                    </TableRow>
                                )}
                                {connectors.map(c => (
                                    <SlaConfigRow
                                        key={c.id}
                                        connector={c}
                                        currentSla={slas.find(s => s.connectorId === c.id)}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// --- Main Page Component ---

export default function MonitoringDashboard() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Monitoring & Alerts</h1>
                <p className="text-muted-foreground">
                    Operations dashboard for integration health and SLA enforcement.
                </p>
            </div>

            <Tabs defaultValue="health" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="health" className="flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Health
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> Alerts
                    </TabsTrigger>
                    <TabsTrigger value="slas" className="flex items-center gap-2">
                        <Settings className="w-4 h-4" /> SLAs
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="health" className="space-y-4">
                    <ConnectorHealthTab />
                </TabsContent>
                <TabsContent value="alerts" className="space-y-4">
                    <AlertsInboxTab />
                </TabsContent>
                <TabsContent value="slas" className="space-y-4">
                    <SlaConfigTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
