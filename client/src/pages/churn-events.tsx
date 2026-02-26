import { useState } from "react";
import { useChurnEvents } from "@/hooks/use-churn";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Code, Eye } from "lucide-react";

// Fallback hook since use-schools seems missing or named differently
function useSchools() {
    return useQuery<any[]>({
        queryKey: ["/api/schools"],
    });
}

export default function ChurnEventsPage() {
    const [selectedSchool, setSelectedSchool] = useState<string>("all");
    const [selectedSource, setSelectedSource] = useState<string>("all");

    const { data: schools } = useSchools();
    const { data: events, isLoading } = useChurnEvents({
        school_id: selectedSchool !== "all" ? selectedSchool : undefined,
        source_type: selectedSource !== "all" ? selectedSource : undefined,
        limit: 500
    });

    const [viewingPayload, setViewingPayload] = useState<any>(null);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Churn Audit Logs</h1>
                <p className="text-muted-foreground mt-1">Immutable ledger of engine-identified churn incidents.</p>
            </div>

            <div className="flex gap-4">
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                    <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="All Schools" />
                    </SelectTrigger>
                    <SelectContent>
                        {schools?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={selectedSource} onValueChange={setSelectedSource}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="lead">Leads</SelectItem>
                        <SelectItem value="enrollment">Enrollments</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardHeader className="pb-3 border-b">
                    <CardTitle>Identified Events</CardTitle>
                    <CardDescription>Recent churn classifications triggering analytical review.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead>Detected</TableHead>
                                <TableHead>School</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Reasoning</TableHead>
                                <TableHead className="text-right">Payload</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Loading audit logs...</TableCell>
                                </TableRow>
                            ) : events?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No churn events found matching criteria.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                events?.map((event) => (
                                    <TableRow key={event.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(event.detectedAt), "MMM d, yyyy HH:mm")}
                                        </TableCell>
                                        <TableCell>{event.school_name}</TableCell>
                                        <TableCell>
                                            <Badge variant={event.sourceType === "lead" ? "outline" : "secondary"}>
                                                {event.sourceType.toUpperCase()}
                                            </Badge>
                                            <span className="ml-2 text-xs text-muted-foreground truncate max-w-[120px] inline-block align-bottom">{event.sourceId}</span>
                                        </TableCell>
                                        <TableCell className="max-w-[300px] truncate" title={event.churnReason || ""}>
                                            {event.churnReason || "Manual Flag"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => setViewingPayload(event)}>
                                                <Eye className="w-4 h-4 mr-2" /> Inspect
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Sheet open={!!viewingPayload} onOpenChange={(open) => !open && setViewingPayload(null)}>
                <SheetContent className="w-[500px] sm:w-[600px] max-w-none overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle>Audit Snapshot Inspection</SheetTitle>
                        <SheetDescription>Deep-dive into the raw entity state captured at the moment the engine flagged this record.</SheetDescription>
                    </SheetHeader>

                    {viewingPayload && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 p-4 rounded-lg border border-border">
                                <div><span className="text-muted-foreground">Detected:</span> {format(new Date(viewingPayload.detectedAt), "PPp")}</div>
                                <div><span className="text-muted-foreground">Origin:</span> {viewingPayload.detectedBy}</div>
                                <div><span className="text-muted-foreground">School:</span> {viewingPayload.school_name}</div>
                                <div><span className="text-muted-foreground">Target ID:</span> {viewingPayload.sourceId}</div>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm flex items-center mb-2"><Code className="w-4 h-4 mr-2" /> Raw Context Payload</h4>
                                <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-xs font-mono overflow-auto max-h-[600px]">
                                    {JSON.stringify(viewingPayload.payload, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
