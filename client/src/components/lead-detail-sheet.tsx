import { useLead, useUpdateLead, usePromoteLead, PIPELINE_STAGES, getStageLabel, getStageColor, canEditLead } from "@/hooks/use-leads";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, Mail, Globe, Calendar, MapPin, Building2, ExternalLink, GraduationCap, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Lead } from "@shared/schema";

const LEAD_SOURCE_LABELS: Record<string, string> = {
  form: "Formulário",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  google_ads: "Google Ads",
  referral: "Indicação",
  other: "Outro",
};

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
  const promoteLead = usePromoteLead();

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [contractValue, setContractValue] = useState("");

  const isOpen = !!leadId;
  const canEdit = canEditLead(user?.role, user?.id, lead);
  const canPromote = ["admin", "finance", "ops"].includes(user?.role ?? "");
  const alreadyConverted = !!(lead as any)?.convertedEnrollmentId;

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
  const leadSourceLabel = (lead as any)?.leadSource
    ? LEAD_SOURCE_LABELS[(lead as any).leadSource] ?? (lead as any).leadSource
    : null;

  const handlePromote = () => {
    if (!lead) return;
    promoteLead.mutate(
      {
        id: lead.id,
        schoolId: lead.schoolId ?? undefined,
        contractValue: contractValue ? parseFloat(contractValue) : undefined,
      },
      {
        onSuccess: () => {
          setPromoteOpen(false);
          setContractValue("");
          toast({ title: "Lead convertido com sucesso!", description: "Matrícula criada e lead marcado como Ganho." });
        },
        onError: (err: any) => {
          const status = err?.status;
          if (status === 409) {
            toast({
              title: "Duplicata detectada",
              description: err?.data?.message ?? "Matrícula já existe para este email/CPF.",
              variant: "destructive",
            });
          } else {
            toast({ title: "Erro", description: err?.message ?? "Falha ao promover lead.", variant: "destructive" });
          }
          setPromoteOpen(false);
        },
      }
    );
  };

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
    <>
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
                {leadSourceLabel && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Globe className="h-3 w-3" />
                    {leadSourceLabel}
                  </Badge>
                )}
                {alreadyConverted && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-500 gap-1">
                    <GraduationCap className="h-3 w-3" />
                    Convertido
                  </Badge>
                )}
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
                    {/* Promote to enrollment */}
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {alreadyConverted
                          ? "Este lead já foi convertido em matrícula."
                          : canPromote
                            ? "Promover este lead para matrícula ativa."
                            : "Conversão financeira restrita a Administrador, Financeiro ou Operações."}
                      </p>
                      <Button
                        variant={alreadyConverted ? "secondary" : "default"}
                        size="sm"
                        className="w-full gap-2"
                        disabled={!canPromote || alreadyConverted || promoteLead.isPending}
                        onClick={() => setPromoteOpen(true)}
                        data-testid="button-promote-lead"
                      >
                        {promoteLead.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : alreadyConverted ? (
                          <GraduationCap className="h-4 w-4" />
                        ) : (
                          <GraduationCap className="h-4 w-4" />
                        )}
                        {alreadyConverted ? "Já Convertido" : "Promover para Matrícula"}
                      </Button>
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

      {/* Promote confirm dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Promover para Matrícula
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-3 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Uma nova matrícula será criada para <strong>{name}</strong>. O lead será marcado como <em>Ganho</em> e não poderá ser convertido novamente.
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-value">Valor do Contrato (opcional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
                <Input
                  id="contract-value"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="pl-9"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  data-testid="input-contract-value"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handlePromote}
              disabled={promoteLead.isPending}
              data-testid="button-confirm-promote"
            >
              {promoteLead.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Conversão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
