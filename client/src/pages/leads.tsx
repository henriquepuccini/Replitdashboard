import { useState } from "react";
import { useLeads, PIPELINE_STAGES, getStageLabel, getStageColor } from "@/hooks/use-leads";
import { useSchools } from "@/hooks/use-kpis";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Lead } from "@shared/schema";

export default function LeadsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const { data: schools } = useSchools();

  const isSeller = user?.role === "seller";
  const limit = 25;

  const filters = {
    ...(search ? { search } : {}),
    ...(stageFilter !== "all" ? { stage: stageFilter } : {}),
    ...(schoolFilter !== "all" ? { school_id: schoolFilter } : {}),
    ...(periodStart ? { period_start: periodStart } : {}),
    ...(periodEnd ? { period_end: periodEnd } : {}),
    page,
    limit,
  };

  const { data: leadsResp, isLoading } = useLeads(filters);
  const leads = leadsResp?.data || [];
  const total = leadsResp?.total || 0;
  const totalPages = leadsResp?.totalPages || 1;

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold" data-testid="text-leads-title">
        Leads
      </h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8"
            data-testid="input-lead-search"
          />
        </div>
        <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-lead-stage">
            <SelectValue placeholder="Estágio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estágios</SelectItem>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isSeller && (
          <Select value={schoolFilter} onValueChange={(v) => { setSchoolFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44" data-testid="select-lead-school">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {schools?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={periodStart}
            onChange={(e) => { setPeriodStart(e.target.value); setPage(1); }}
            className="w-36"
            data-testid="input-period-start"
          />
          <span className="text-muted-foreground text-sm">até</span>
          <Input
            type="date"
            value={periodEnd}
            onChange={(e) => { setPeriodEnd(e.target.value); setPage(1); }}
            className="w-36"
            data-testid="input-period-end"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Interação</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum lead encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLeadId(lead.id)}
                      data-testid={`row-lead-${lead.id}`}
                    >
                      <TableCell className="font-medium">{getLeadName(lead)}</TableCell>
                      <TableCell className="text-sm">{getLeadEmail(lead) || "—"}</TableCell>
                      <TableCell className="text-sm">{getLeadPhone(lead) || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${getStageColor(lead.stage)}`} />
                          {getStageLabel(lead.stage)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lead.status === "open" ? "default" : "secondary"} className="text-xs">
                          {lead.status === "open" ? "Aberto" : lead.status === "deleted" ? "Excluído" : lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.lastInteraction
                          ? format(new Date(lead.lastInteraction), "dd/MM/yy HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(lead.createdAt), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" data-testid={`button-view-lead-${lead.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-leads-count">
              {total} lead{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <LeadDetailSheet
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />
    </div>
  );
}
