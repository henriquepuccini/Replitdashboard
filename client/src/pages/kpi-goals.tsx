import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useKpis,
  useKpiGoals,
  useSchools,
  useCreateKpiGoal,
  useUpdateKpiGoal,
  useDeleteKpiGoal,
} from "@/hooks/use-kpis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import type { KpiGoal } from "@shared/schema";

interface GoalFormData {
  kpiId: string;
  schoolId: string | null;
  periodStart: string;
  periodEnd: string;
  target: string;
}

function GoalFormDialog({
  open,
  onClose,
  kpis,
  schools,
  initialData,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  kpis: { id: string; name: string }[];
  schools: { id: string; name: string }[];
  initialData?: GoalFormData;
  onSubmit: (data: GoalFormData) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<GoalFormData>(
    initialData || {
      kpiId: kpis[0]?.id || "",
      schoolId: null,
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10),
      periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        .toISOString()
        .slice(0, 10),
      target: "",
    }
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Meta" : "Nova Meta"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>KPI</Label>
            <Select
              value={form.kpiId}
              onValueChange={(v) => setForm({ ...form, kpiId: v })}
              disabled={!!initialData}
            >
              <SelectTrigger data-testid="select-goal-kpi">
                <SelectValue placeholder="Selecione o KPI" />
              </SelectTrigger>
              <SelectContent>
                {kpis.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Escola</Label>
            <Select
              value={form.schoolId || "network"}
              onValueChange={(v) =>
                setForm({ ...form, schoolId: v === "network" ? null : v })
              }
            >
              <SelectTrigger data-testid="select-goal-school">
                <SelectValue placeholder="Rede (todas)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="network">Rede (todas)</SelectItem>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início do Período</Label>
              <Input
                type="date"
                value={form.periodStart}
                onChange={(e) =>
                  setForm({ ...form, periodStart: e.target.value })
                }
                data-testid="input-goal-period-start"
              />
            </div>
            <div className="space-y-2">
              <Label>Fim do Período</Label>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={(e) =>
                  setForm({ ...form, periodEnd: e.target.value })
                }
                data-testid="input-goal-period-end"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Meta (valor alvo)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="Ex: 100"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              data-testid="input-goal-target"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-goal-cancel">
            Cancelar
          </Button>
          <Button
            onClick={() => onSubmit(form)}
            disabled={isPending || !form.kpiId || !form.target}
            data-testid="button-goal-save"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function KpiGoalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const isDirector = user?.role === "director";
  const canManageGoals = isAdmin || isDirector;

  const { data: kpis, isLoading: kpisLoading } = useKpis();
  const { data: schools, isLoading: schoolsLoading } = useSchools();

  const [selectedKpi, setSelectedKpi] = useState<string>("");
  const [selectedSchool, setSelectedSchool] = useState<string>("network");

  const effectiveKpiId = selectedKpi || kpis?.[0]?.id;
  const effectiveSchoolId = selectedSchool === "network" ? undefined : selectedSchool;

  const { data: goals, isLoading: goalsLoading } = useKpiGoals(
    effectiveKpiId,
    effectiveSchoolId
  );

  const createGoal = useCreateKpiGoal(effectiveKpiId || "");
  const updateGoal = useUpdateKpiGoal(effectiveKpiId || "");
  const deleteGoal = useDeleteKpiGoal(effectiveKpiId || "");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<KpiGoal | null>(null);

  const schoolsMap: Record<string, string> = {};
  schools?.forEach((s) => {
    schoolsMap[s.id] = s.name;
  });

  const handleCreate = async (data: GoalFormData) => {
    try {
      await createGoal.mutateAsync({
        schoolId: data.schoolId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        target: data.target,
      });
      toast({ title: "Meta criada com sucesso" });
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: "Erro ao criar meta",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (data: GoalFormData) => {
    if (!editingGoal) return;
    try {
      await updateGoal.mutateAsync({
        goalId: editingGoal.id,
        schoolId: data.schoolId,
        target: data.target,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      });
      toast({ title: "Meta atualizada" });
      setEditingGoal(null);
    } catch (e) {
      toast({
        title: "Erro ao atualizar meta",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (goalId: string) => {
    try {
      await deleteGoal.mutateAsync(goalId);
      toast({ title: "Meta removida" });
    } catch (e) {
      toast({
        title: "Erro ao remover meta",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const isLoading = kpisLoading || schoolsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="text-goals-title"
          >
            Gestão de Metas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina e acompanhe metas por escola e período
          </p>
        </div>
        {canManageGoals && (
          <Button
            onClick={() => setDialogOpen(true)}
            data-testid="button-new-goal"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nova Meta
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedKpi || (kpis?.[0]?.id ?? "")}
          onValueChange={setSelectedKpi}
        >
          <SelectTrigger className="w-[220px]" data-testid="select-goals-kpi">
            <SelectValue placeholder="Selecione o KPI" />
          </SelectTrigger>
          <SelectContent>
            {kpis?.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSchool} onValueChange={setSelectedSchool}>
          <SelectTrigger className="w-[200px]" data-testid="select-goals-school">
            <SelectValue placeholder="Escola" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="network">Rede (todas)</SelectItem>
            {schools?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading || goalsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !goals?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground opacity-30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma meta definida para este filtro
            </p>
            {canManageGoals && (
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() => setDialogOpen(true)}
                data-testid="button-create-first-goal"
              >
                Criar primeira meta
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {goals.length} meta{goals.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Criado Em</TableHead>
                  {canManageGoals && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => (
                  <TableRow key={goal.id} data-testid={`row-goal-${goal.id}`}>
                    <TableCell className="text-sm">
                      {goal.periodStart} → {goal.periodEnd}
                    </TableCell>
                    <TableCell className="text-sm">
                      {goal.schoolId
                        ? schoolsMap[goal.schoolId] || goal.schoolId
                        : "Rede"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {parseFloat(goal.target).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(goal.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    {canManageGoals && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingGoal(goal)}
                            data-testid={`button-edit-goal-${goal.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDelete(goal.id)}
                              disabled={deleteGoal.isPending}
                              data-testid={`button-delete-goal-${goal.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {dialogOpen && kpis && schools && (
        <GoalFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          kpis={kpis.map((k) => ({ id: k.id, name: k.name }))}
          schools={schools.map((s) => ({ id: s.id, name: s.name }))}
          onSubmit={handleCreate}
          isPending={createGoal.isPending}
        />
      )}

      {editingGoal && kpis && schools && (
        <GoalFormDialog
          open={!!editingGoal}
          onClose={() => setEditingGoal(null)}
          kpis={kpis.map((k) => ({ id: k.id, name: k.name }))}
          schools={schools.map((s) => ({ id: s.id, name: s.name }))}
          initialData={{
            kpiId: editingGoal.kpiId,
            schoolId: editingGoal.schoolId,
            periodStart: editingGoal.periodStart,
            periodEnd: editingGoal.periodEnd,
            target: editingGoal.target,
          }}
          onSubmit={handleUpdate}
          isPending={updateGoal.isPending}
        />
      )}
    </div>
  );
}
