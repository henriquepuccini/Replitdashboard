import { useLead, useUpdateLead, PIPELINE_STAGES, getStageLabel, getStageColor, canEditLead } from "@/hooks/use-leads";
import { useSchools } from "@/hooks/use-kpis";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Phone, Mail, Globe, Calendar, User, MapPin, Building2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@shared/schema";

interface LeadDetailSheetProps {
  leadId: string | null;
  onClose: () => void;
}

export function LeadDetailSheet({ leadId, onClose }: LeadDetailSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: lead, isLoading } = useLead(leadId ?? undefined);
  const { data: schools } = useSchools();
  const updateLead = useUpdateLead();

  const isOpen = !!leadId;
  const canEdit = canEditLead(user?.role, user?.id, lead);

  const getPayloadField = (key: string): string => {
    if (!lead) return "";
    const p = lead.payload as Record<string, unknown>;
    return String(p[key] || "");
  };

  const name = getPayloadField("name") || getPayloadField("nome") || getPayloadField("full_name") || lead?.sourceId || "Sem nome";
  const email = getPayloadField("email");
  const phone = getPayloadField("phone") || getPayloadField("telefone") || getPayloadField("cel");
  const address = getPayloadField("address") || getPayloadField("endereco");
  const origin = getPayloadField("source") || getPayloadField("origem") || getPayloadField("utm_source");
  const notes = getPayloadField("notes") || getPayloadField("observacoes");

  const schoolName = lead?.schoolId
    ? schools?.find((s: any) => s.id === lead.schoolId)?.name || "—"
    : "—";

  const handleStageChange = (newStage: string) => {
    if (!lead) return;
    updateLead.mutate(
      { id: lead.id, stage: newStage, lastInteraction: new Date().toISOString() },
      {
        onSuccess: () => toast({ title: "Estágio atualizado" }),
        onError: () => toast({ title: "Erro", description: "Falha ao atualizar estágio", variant: "destructive" }),
      }
    );
  };

  const handleStatusChange = (newStatus: string) => {
    if (!lead) return;
    updateLead.mutate(
      { id: lead.id, status: newStatus },
      {
        onSuccess: () => toast({ title: "Status atualizado" }),
        onError: () => toast({ title: "Erro", description: "Falha ao atualizar status", variant: "destructive" }),
      }
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-lead-detail">
        <SheetHeader>
          <SheetTitle data-testid="text-lead-detail-name">{name}</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lead ? (
          <div className="space-y-6 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <span className={`w-2 h-2 rounded-full mr-1.5 ${getStageColor(lead.stage)}`} />
                {getStageLabel(lead.stage)}
              </Badge>
              <Badge variant={lead.status === "open" ? "default" : "secondary"} className="text-xs">
                {lead.status === "open" ? "Aberto" : lead.status === "deleted" ? "Excluído" : lead.status}
              </Badge>
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Contato
              </h3>
              <div className="space-y-2">
                {email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={`mailto:${email}`}
                      className="text-sm text-primary hover:underline truncate"
                      data-testid="link-lead-email"
                    >
                      {email}
                    </a>
                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                      <a href={`mailto:${email}`} aria-label="Enviar email">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={`tel:${phone}`}
                      className="text-sm text-primary hover:underline"
                      data-testid="link-lead-phone"
                    >
                      {phone}
                    </a>
                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                      <a href={`tel:${phone}`} aria-label="Ligar">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                )}
                {address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm">{address}</span>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Informações
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Unidade</p>
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span>{schoolName}</span>
                  </div>
                </div>
                {origin && (
                  <div>
                    <p className="text-muted-foreground text-xs">Origem</p>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span>{origin}</span>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Criado em</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
                {lead.lastInteraction && (
                  <div>
                    <p className="text-muted-foreground text-xs">Última interação</p>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{format(new Date(lead.lastInteraction), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {notes && (
              <>
                <Separator />
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Observações
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{notes}</p>
                </section>
              </>
            )}

            {canEdit && (
              <>
                <Separator />
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Ações
                  </h3>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Mover para estágio</label>
                      <Select value={lead.stage} onValueChange={handleStageChange}>
                        <SelectTrigger data-testid="select-lead-stage-change">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PIPELINE_STAGES.map((s) => (
                            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                      <Select value={lead.status} onValueChange={handleStatusChange}>
                        <SelectTrigger data-testid="select-lead-status-change">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="closed">Fechado</SelectItem>
                          <SelectItem value="deleted">Excluído (soft delete)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {email && (
                      <Button variant="outline" size="sm" asChild data-testid="button-action-email">
                        <a href={`mailto:${email}`}>
                          <Mail className="h-4 w-4 mr-1" /> Email
                        </a>
                      </Button>
                    )}
                    {phone && (
                      <Button variant="outline" size="sm" asChild data-testid="button-action-call">
                        <a href={`tel:${phone}`}>
                          <Phone className="h-4 w-4 mr-1" /> Ligar
                        </a>
                      </Button>
                    )}
                  </div>
                </section>
              </>
            )}

            <Separator />
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Dados Brutos (Payload)
              </h3>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-48" data-testid="text-lead-payload">
                {JSON.stringify(lead.payload, null, 2)}
              </pre>
            </section>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Lead não encontrado</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
