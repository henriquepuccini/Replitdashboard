import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useConnectors,
  useSchools,
  useCreateConnector,
  useDeleteConnector,
  useRunConnector,
} from "@/hooks/use-connectors";
import type { Connector, ConnectorType } from "@shared/schema";
import { CONNECTOR_TYPES } from "@shared/schema";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import {
  Plus,
  Play,
  Settings,
  Trash2,
  Plug,
  RefreshCw,
  Search,
  CircleDot,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  crm: "CRM",
  finance: "Financeiro",
  academic: "Acadêmico",
};

const TYPE_VARIANTS: Record<string, string> = {
  crm: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  finance: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  academic: "bg-chart-4/15 text-chart-4 border-chart-4/30",
};

const createConnectorSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["crm", "finance", "academic"], {
    required_error: "Tipo é obrigatório",
  }),
  baseUrl: z.string().url("URL base inválida").optional().or(z.literal("")),
  scheduleCron: z.string().optional().or(z.literal("")),
});

type CreateConnectorForm = z.infer<typeof createConnectorSchema>;

function RunButton({ connectorId }: { connectorId: string }) {
  const runMutation = useRunConnector(connectorId);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          disabled={runMutation.isPending}
          onClick={(e) => {
            e.stopPropagation();
            runMutation.mutate({});
          }}
          data-testid={`button-run-connector-${connectorId}`}
        >
          {runMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Executar sincronização</TooltipContent>
    </Tooltip>
  );
}

export default function IntegrationsPage() {
  const { user } = useAuth();
  const { data: connectors, isLoading } = useConnectors();
  const { data: schools } = useSchools();
  const createMutation = useCreateConnector();
  const deleteMutation = useDeleteConnector();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Connector | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");

  const isAdmin = user?.role === "admin";
  const isOps = user?.role === "ops";
  const canCreate = isAdmin;
  const canRunOrDelete = isAdmin || isOps;

  const form = useForm<CreateConnectorForm>({
    resolver: zodResolver(createConnectorSchema),
    defaultValues: { name: "", type: "crm", baseUrl: "", scheduleCron: "" },
  });

  function handleCreate(data: CreateConnectorForm) {
    const config: Record<string, unknown> = {};
    if (data.baseUrl) config.baseUrl = data.baseUrl;
    createMutation.mutate(
      {
        name: data.name,
        type: data.type,
        config,
        scheduleCron: data.scheduleCron || null,
      },
      {
        onSuccess: () => {
          setAddDialogOpen(false);
          form.reset();
        },
      }
    );
  }

  const filtered = (connectors || []).filter((c) => {
    if (filterType !== "all" && c.type !== filterType) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const name = (c.name || "").toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  });

  function getSchoolName(config: Record<string, unknown> | null): string {
    if (!config || !schools) return "—";
    const schoolId = config.schoolId as string | undefined;
    if (!schoolId) return "—";
    return schools.find((s) => s.id === schoolId)?.name || "—";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="text-integrations-title"
          >
            Integrações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os conectores de dados externos
          </p>
        </div>
        {canCreate && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-connector">
                <Plus className="h-4 w-4 mr-2" />
                Novo Conector
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Conector</DialogTitle>
                <DialogDescription>
                  Configure uma nova integração com dados externos
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleCreate)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="CRM Escola Alfa"
                            data-testid="input-connector-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger data-testid="select-connector-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONNECTOR_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {TYPE_LABELS[t] || t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="baseUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Base (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://api.exemplo.com"
                            data-testid="input-connector-url"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scheduleCron"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agendamento Cron (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="0 */6 * * *"
                            data-testid="input-connector-cron"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-connector"
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Conector"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conector..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="pl-9"
            data-testid="input-filter-search"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {CONNECTOR_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t] || t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Conectores ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Plug className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {connectors?.length === 0
                  ? "Nenhum conector configurado ainda"
                  : "Nenhum conector encontrado com os filtros aplicados"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Escola</TableHead>
                    <TableHead>Agendamento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      data-testid={`row-connector-${c.id}`}
                    >
                      <TableCell>
                        <Link
                          href={`/integrations/${c.id}`}
                          className="font-medium hover:underline"
                          data-testid={`link-connector-${c.id}`}
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={TYPE_VARIANTS[c.type] || ""}
                          data-testid={`badge-type-${c.id}`}
                        >
                          {TYPE_LABELS[c.type] || c.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <CircleDot
                            className={`h-3 w-3 ${c.isActive ? "text-green-500" : "text-muted-foreground/50"}`}
                          />
                          <span
                            className="text-sm"
                            data-testid={`text-status-${c.id}`}
                          >
                            {c.isActive ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-sm text-muted-foreground"
                          data-testid={`text-school-${c.id}`}
                        >
                          {getSchoolName(c.config)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-sm text-muted-foreground font-mono"
                          data-testid={`text-cron-${c.id}`}
                        >
                          {c.scheduleCron || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canRunOrDelete && <RunButton connectorId={c.id} />}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                asChild
                                data-testid={`button-detail-connector-${c.id}`}
                              >
                                <Link href={`/integrations/${c.id}`}>
                                  <Settings className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Configurar</TooltipContent>
                          </Tooltip>
                          {isAdmin && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteTarget(c)}
                                  data-testid={`button-delete-connector-${c.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conector</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o conector &quot;{deleteTarget?.name}&quot;?
              Todos os mapeamentos, execuções e dados sincronizados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
