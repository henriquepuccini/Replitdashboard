import { useState, useMemo, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useLeads, useUpdateLead, PIPELINE_STAGES, getStageLabel, canEditLead } from "@/hooks/use-leads";
import { useSchools } from "@/hooks/use-kpis";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, GripVertical, User, Phone, Mail, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import type { Lead } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePipelineMetrics, useUpdatePipelineGoal } from "@/hooks/use-pipeline-metrics";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function PipelinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const { data: schools } = useSchools();
  const updateLead = useUpdateLead();

  const isSeller = user?.role === "seller";
  const filters = {
    ...(schoolFilter !== "all" ? { school_id: schoolFilter } : {}),
    ...(searchQuery ? { search: searchQuery } : {}),
    limit: 200,
  };

  const { data: leadsResp, isLoading } = useLeads(filters);
  const leads = leadsResp?.data || [];

  const metricsFilters = useMemo(() => ({
    school_id: schoolFilter,
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  }), [schoolFilter]);

  const { data: metricsData, isLoading: isLoadingMetrics } = usePipelineMetrics(user?.id, metricsFilters);
  const updateGoal = useUpdatePipelineGoal(user?.id);
  const [goalInput, setGoalInput] = useState("");
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);

  const handleSetGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(goalInput);
    if (isNaN(target) || target <= 0) {
      toast({ title: "Invalido", description: "Meta deve ser um número maior que zero.", variant: "destructive" });
      return;
    }

    updateGoal.mutate({
      target,
      periodStart: format(metricsFilters.from, "yyyy-MM-dd"),
      periodEnd: format(metricsFilters.to, "yyyy-MM-dd")
    }, {
      onSuccess: () => {
        setIsGoalDialogOpen(false);
        toast({ title: "Sucesso", description: "Meta definida." });
      },
      onError: () => {
        toast({ title: "Erro", description: "Falha ao salvar meta.", variant: "destructive" });
      }
    });
  };

  const stageGroups = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    for (const stage of PIPELINE_STAGES) {
      groups[stage.key] = [];
    }
    for (const lead of leads) {
      if (groups[lead.stage]) {
        groups[lead.stage].push(lead);
      } else {
        if (!groups["new"]) groups["new"] = [];
        groups["new"].push(lead);
      }
    }
    return groups;
  }, [leads]);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const { draggableId, destination } = result;
      const newStage = destination.droppableId;

      const lead = leads.find((l) => l.id === draggableId);
      if (!lead || lead.stage === newStage) return;

      if (!canEditLead(user?.role, user?.id, lead)) {
        toast({ title: "Sem permissão", description: "Você não tem permissão para mover este lead.", variant: "destructive" });
        return;
      }

      updateLead.mutate(
        { id: draggableId, stage: newStage, lastInteraction: new Date().toISOString() },
        {
          onError: () => {
            toast({ title: "Erro", description: "Falha ao atualizar estágio. Alteração revertida.", variant: "destructive" });
          },
        }
      );
    },
    [leads, filters, user?.role, user?.id, updateLead, toast]
  );

  const getLeadName = (lead: Lead) => {
    const p = lead.payload as Record<string, unknown>;
    return String(p.name || p.nome || p.full_name || lead.sourceId || "Sem nome");
  };

  const getLeadEmail = (lead: Lead) => {
    const p = lead.payload as Record<string, unknown>;
    return String(p.email || "");
  };

  const getLeadPhone = (lead: Lead) => {
    const p = lead.payload as Record<string, unknown>;
    return String(p.phone || p.telefone || p.cel || "");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 px-1">
        <h1 className="text-2xl font-bold" data-testid="text-pipeline-title">
          Pipeline de Vendas
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-48"
              data-testid="input-pipeline-search"
            />
          </div>
          {!isSeller && (
            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
              <SelectTrigger className="w-44" data-testid="select-pipeline-school">
                <SelectValue placeholder="Todas as unidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {schools?.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!isLoadingMetrics && metricsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Goal Progress Card */}
          <div className="rounded-lg border bg-card text-card-foreground p-4 shadow-sm flex flex-col justify-center">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Progresso da Meta ({format(new Date(), 'MMMM', { locale: ptBR })})</span>
              {isSeller && (
                <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2">Definir Meta</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Definir Meta do Mês</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSetGoal} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Meta de Matrículas</Label>
                        <Input
                          type="number"
                          value={goalInput}
                          onChange={(e) => setGoalInput(e.target.value)}
                          placeholder="Ex: 50"
                          min="1"
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={updateGoal.isPending}>
                        {updateGoal.isPending ? "Salvando..." : "Salvar Meta"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {metricsData.goal ? (
              <>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{metricsData.metrics.totalEnrollments} realizadas</span>
                  <span>{metricsData.goal} meta</span>
                </div>
                <Progress value={Math.min(100, (metricsData.metrics.totalEnrollments / metricsData.goal) * 100)} className="h-2" />
                <p className="text-xs text-right mt-1 font-medium text-muted-foreground">
                  {((metricsData.metrics.totalEnrollments / metricsData.goal) * 100).toFixed(0)}%
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-2">
                Meta não definida para este mês
              </div>
            )}
          </div>

          {/* Conversion Rate Card */}
          <div className="rounded-lg border bg-card text-card-foreground p-4 shadow-sm flex flex-col justify-center">
            <span className="text-sm font-medium mb-2">Taxa de Conversão Pessoal</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{metricsData.metrics.conversionRate.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                vs {metricsData.schoolAvgConversion.toFixed(1)}% média esc.
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metricsData.metrics.totalEnrollments} matrículas de {metricsData.metrics.totalLeads} leads
            </p>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
          {PIPELINE_STAGES.filter((s) => s.key !== "lost").map((stage) => (
            <Droppable key={stage.key} droppableId={stage.key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-shrink-0 w-72 flex flex-col rounded-lg border ${snapshot.isDraggingOver
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30"
                    }`}
                  data-testid={`column-stage-${stage.key}`}
                >
                  <div className="flex items-center justify-between p-3 border-b">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                        <span className="font-semibold text-sm">{stage.label}</span>
                      </div>
                      {metricsData?.timePerStage[stage.key] !== undefined && (
                        <span className="text-[10px] text-muted-foreground mt-0.5 ml-4">
                          Tempo médio: {metricsData.timePerStage[stage.key]} dias
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs" data-testid={`badge-count-${stage.key}`}>
                      {stageGroups[stage.key]?.length || 0}
                    </Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
                    {stageGroups[stage.key]?.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`group rounded-md border bg-card p-3 shadow-sm cursor-pointer transition-shadow ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30" : "hover:shadow-md"
                              }`}
                            onClick={() => setSelectedLeadId(lead.id)}
                            data-testid={`card-lead-${lead.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                {...provided.dragHandleProps}
                                className="mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Arrastar lead"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate" data-testid={`text-lead-name-${lead.id}`}>
                                  {getLeadName(lead)}
                                </p>
                                {getLeadEmail(lead) && (
                                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                    <Mail className="h-3 w-3" />
                                    {getLeadEmail(lead)}
                                  </p>
                                )}
                                {getLeadPhone(lead) && (
                                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {getLeadPhone(lead)}
                                  </p>
                                )}
                                <div className="flex items-center gap-1 mt-1.5">
                                  {lead.lastInteraction && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {format(new Date(lead.lastInteraction), "dd/MM HH:mm", { locale: ptBR })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {(!stageGroups[stage.key] || stageGroups[stage.key].length === 0) && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhum lead
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      <LeadDetailSheet
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />
    </div>
  );
}
