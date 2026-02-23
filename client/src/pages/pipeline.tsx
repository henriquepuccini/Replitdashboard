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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
          {PIPELINE_STAGES.filter((s) => s.key !== "lost").map((stage) => (
            <Droppable key={stage.key} droppableId={stage.key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-shrink-0 w-72 flex flex-col rounded-lg border ${
                    snapshot.isDraggingOver
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30"
                  }`}
                  data-testid={`column-stage-${stage.key}`}
                >
                  <div className="flex items-center justify-between p-3 border-b">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                      <span className="font-semibold text-sm">{stage.label}</span>
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
                            className={`group rounded-md border bg-card p-3 shadow-sm cursor-pointer transition-shadow ${
                              snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30" : "hover:shadow-md"
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
