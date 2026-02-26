import { useState } from "react";
import { useChurnRules, useCreateChurnRule, useUpdateChurnRule, useDeleteChurnRule, useRunChurnRule, useChurnRuns } from "@/hooks/use-churn";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Play, Save, Plus, Trash, History, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

// Fallback hook since use-schools seems missing or named differently natively yet
function useSchools() {
    return useQuery<any[]>({
        queryKey: ["/api/schools"],
    });
}

export default function ChurnRulesPage() {
    const { data: rules, isLoading } = useChurnRules();
    const { data: schools } = useSchools();
    const { user } = useAuth();

    const [editingRule, setEditingRule] = useState<any>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [viewingHistoryRuleId, setViewingHistoryRuleId] = useState<string | null>(null);

    const canManage = user?.role === "admin" || user?.role === "director";

    const handleOpenCreate = () => {
        setEditingRule({
            name: "",
            schoolId: user?.role === "admin" ? "" : user?.schoolId,
            isActive: true,
            config: JSON.stringify({
                source: "lead",
                conditions: [
                    { field: "stage", operator: "eq", value: "lost" }
                ]
            }, null, 2)
        });
        setIsEditorOpen(true);
    };

    if (isLoading) return <div className="p-8">Loading rules...</div>;

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Churn Rules Engine</h1>
                    <p className="text-muted-foreground mt-1">Configure DSL rules to dynamically detect and flag churned leads and enrollments.</p>
                </div>
                {canManage && (
                    <Button onClick={handleOpenCreate}>
                        <Plus className="mr-2 h-4 w-4" /> New Rule
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rules?.map((rule: any) => (
                    <RuleCard
                        key={rule.id}
                        rule={rule}
                        onEdit={() => {
                            setEditingRule({ ...rule, config: JSON.stringify(rule.config, null, 2) });
                            setIsEditorOpen(true);
                        }}
                        onViewHistory={() => setViewingHistoryRuleId(rule.id)}
                    />
                ))}
                {(!rules || rules.length === 0) && (
                    <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        No churn rules configured yet.{canManage && " Create one to get started."}
                    </div>
                )}
            </div>

            {isEditorOpen && (
                <RuleEditorDialog
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                    initialData={editingRule}
                    schools={schools}
                    isAdmin={user?.role === "admin"}
                />
            )}

            {viewingHistoryRuleId && (
                <RuleHistoryDialog
                    isOpen={!!viewingHistoryRuleId}
                    onClose={() => setViewingHistoryRuleId(null)}
                    rule={rules?.find((r: any) => r.id === viewingHistoryRuleId)}
                />
            )}
        </div>
    );
}

function RuleCard({ rule, onEdit, onViewHistory }: { rule: any, onEdit: () => void, onViewHistory: () => void }) {
    const { user } = useAuth();
    const { mutate: deleteRule } = useDeleteChurnRule();
    const { mutate: runChurn, isPending: isRunning } = useRunChurnRule();
    const { toast } = useToast();

    const canEdit = user?.role === "admin" || user?.role === "director";

    const handleRun = (dryRun: boolean) => {
        runChurn({ ruleId: rule.id, dryRun }, {
            onSuccess: (data) => {
                toast({
                    title: dryRun ? "Dry Run Complete" : "Execution Complete",
                    description: `Processed ${data.stats.processed} records. Found ${data.stats.churned} churns.`,
                });
            }
        });
    };

    return (
        <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div>
                    <CardTitle className="text-xl">{rule.name}</CardTitle>
                    <CardDescription className="mt-1">{rule.school_name || "Network Global"}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    {!rule.isActive && <Badge variant="secondary">Inactive</Badge>}
                    <Badge variant="outline">{rule.config?.source}</Badge>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {canEdit && <DropdownMenuItem onClick={onEdit}>Edit Rule</DropdownMenuItem>}
                            <DropdownMenuItem onClick={onViewHistory}><History className="mr-2 h-4 w-4" /> Run History</DropdownMenuItem>
                            {canEdit && (
                                <>
                                    <DropdownMenuItem onClick={() => handleRun(true)} disabled={isRunning}>
                                        {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                        Dry Run
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRun(false)} disabled={isRunning} className="text-destructive focus:text-destructive">
                                        <AlertTriangle className="mr-2 h-4 w-4" /> Force Execution
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => deleteRule(rule.id)} className="text-destructive focus:text-destructive">
                                        <Trash className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-sm font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-[120px] whitespace-pre-wrap">
                    {JSON.stringify(rule.config?.conditions, null, 2)}
                </div>
                <div className="text-xs text-muted-foreground mt-4 flex justify-between">
                    <span>Updated: {format(new Date(rule.updatedAt || rule.createdAt), "MMM d, yyyy")}</span>
                </div>
            </CardContent>
        </Card>
    );
}

function RuleEditorDialog({ isOpen, onClose, initialData, schools, isAdmin }: any) {
    const [formData, setFormData] = useState(initialData);
    const [error, setError] = useState<string | null>(null);

    const createRule = useCreateChurnRule();
    const updateRule = useUpdateChurnRule();
    const { toast } = useToast();

    const isSaving = createRule.isPending || updateRule.isPending;

    const handleSave = () => {
        try {
            // Validate JSON safely
            const parsedConfig = JSON.parse(formData.config);
            if (!parsedConfig.source || !Array.isArray(parsedConfig.conditions)) {
                throw new Error("Invalid DSL format. Must contain 'source' and 'conditions' array.");
            }

            const payload = {
                ...formData,
                config: parsedConfig,
                schoolId: formData.schoolId || null
            };

            if (formData.id) {
                updateRule.mutate(payload as any, {
                    onSuccess: () => {
                        toast({ title: "Rule saved successfully" });
                        onClose();
                    },
                    onError: (err: Error | any) => setError(err.message)
                });
            } else {
                createRule.mutate(payload as any, {
                    onSuccess: () => {
                        toast({ title: "Rule saved successfully" });
                        onClose();
                    },
                    onError: (err: Error | any) => setError(err.message)
                });
            }
        } catch (err: any) {
            setError("Invalid JSON DSL: " + err.message);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{formData.id ? "Edit Churn Rule" : "Create Churn Rule"}</DialogTitle>
                    <DialogDescription>Define the operational JSON DSL used by the Edge Engine to flag candidates.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Rule Name</Label>
                            <Input
                                value={formData.name}
                                onChange={(e: any) => setFormData((f: any) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Lost Leads > 30 Days"
                                required
                            />
                        </div>
                        {isAdmin && (
                            <div className="space-y-2">
                                <Label>Target School (Admin Only)</Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                                    value={formData.schoolId || ""}
                                    onChange={(e: any) => setFormData((f: any) => ({ ...f, schoolId: e.target.value }))}
                                >
                                    <option value="">Global Network Rule</option>
                                    {schools?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>DSL Configuration (JSON)</Label>
                        <Textarea
                            value={formData.config}
                            onChange={(e: any) => setFormData((f: any) => ({ ...f, config: e.target.value }))}
                            className="font-mono h-64"
                            placeholder={`{\n  "source": "lead",\n  "conditions": [\n    { "field": "stage", "operator": "eq", "value": "lost" }\n  ]\n}`}
                        />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e: any) => setFormData((f: any) => ({ ...f, isActive: e.target.checked }))} />
                        <Label htmlFor="isActive">Rule is Active</Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Rule
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RuleHistoryDialog({ isOpen, onClose, rule }: any) {
    const { data: runs, isLoading } = useChurnRuns(rule?.id);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Run History: {rule?.name}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    {isLoading ? (
                        <p className="text-muted-foreground">Loading runs...</p>
                    ) : runs && runs.length > 0 ? (
                        <div className="border rounded-md">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="p-3 text-left font-medium">Date</th>
                                        <th className="p-3 text-right font-medium">Processed</th>
                                        <th className="p-3 text-right font-medium">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {runs.map((run: any) => {
                                        const start = new Date(run.startedAt);
                                        const end = run.finishedAt ? new Date(run.finishedAt) : null;
                                        const ms = end ? end.getTime() - start.getTime() : 0;
                                        return (
                                            <tr key={run.id} className="border-b last:border-0 hover:bg-muted/50">
                                                <td className="p-3">{format(start, "MMM d, yyyy HH:mm")}</td>
                                                <td className="p-3 text-right">{run.processedRecords}</td>
                                                <td className="p-3 text-right">{ms}ms</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-6">No execution history found for this rule.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
