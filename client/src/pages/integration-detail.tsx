import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useConnector,
  useConnectorMappings,
  useSyncRuns,
  useRawIngestFiles,
  useSchools,
  useUpdateConnector,
  useRunConnector,
  useCreateMapping,
  useUpdateMapping,
  useDeleteMapping,
} from "@/hooks/use-connectors";
import type { ConnectorMapping, SyncRun } from "@shared/schema";
import { CONNECTOR_TYPES, SYNC_RUN_STATUSES } from "@shared/schema";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRoute, Link } from "wouter";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowRightLeft,
  FileText,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  crm: "CRM",
  finance: "Financeiro",
  academic: "Acadêmico",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  success: {
    label: "Sucesso",
    icon: CheckCircle2,
    className: "text-green-600 dark:text-green-400",
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    className: "text-red-600 dark:text-red-400",
  },
  running: {
    label: "Executando",
    icon: Loader2,
    className: "text-blue-600 dark:text-blue-400",
  },
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "text-muted-foreground",
  },
};

const SENSITIVE_KEYS = ["apiKey", "secret", "password", "token", "oauth"];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => lower.includes(s));
}

function SecureInput({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
        data-testid={testId}
        autoComplete="off"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute right-0 top-0"
        onClick={() => setVisible(!visible)}
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

const configSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["crm", "finance", "academic"]),
  baseUrl: z.string().optional().or(z.literal("")),
  apiKey: z.string().optional().or(z.literal("")),
  dataPath: z.string().optional().or(z.literal("")),
  sourceIdField: z.string().optional().or(z.literal("")),
  paginationType: z.string().optional().or(z.literal("")),
  pageSize: z.string().optional().or(z.literal("")),
  scheduleCron: z.string().optional().or(z.literal("")),
  schoolId: z.string().optional().or(z.literal("")),
});

type ConfigFormValues = z.infer<typeof configSchema>;

const mappingSchema = z.object({
  sourcePath: z.string().min(1, "Caminho de origem obrigatório"),
  targetField: z.string().min(1, "Campo alvo obrigatório"),
  transformJson: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => {
        if (!val || !val.trim()) return true;
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "JSON inválido. Verifique a sintaxe do objeto de transformação." }
    ),
});

type MappingFormValues = z.infer<typeof mappingSchema>;

function parseTransformJson(
  val: string | undefined
): Record<string, unknown> | null {
  if (!val || !val.trim()) return null;
  try {
    const parsed = JSON.parse(val);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return null;
  } catch {
    return null;
  }
}

function ConfigTab({ connectorId }: { connectorId: string }) {
  const { data: connector, isLoading } = useConnector(connectorId);
  const { data: schools } = useSchools();
  const updateMutation = useUpdateConnector(connectorId);

  const config = (connector?.config || {}) as Record<string, unknown>;

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    values: {
      name: connector?.name || "",
      type: (connector?.type as "crm" | "finance" | "academic") || "crm",
      baseUrl: (config.baseUrl as string) || "",
      apiKey: config.apiKey ? "••••••••" : "",
      dataPath: (config.dataPath as string) || "",
      sourceIdField: (config.sourceIdField as string) || "",
      paginationType: (config.paginationType as string) || "",
      pageSize: config.pageSize ? String(config.pageSize) : "",
      scheduleCron: connector?.scheduleCron || "",
      schoolId: (config.schoolId as string) || "",
    },
  });

  function handleSave(data: ConfigFormValues) {
    const newConfig: Record<string, unknown> = { ...config };
    if (data.baseUrl) newConfig.baseUrl = data.baseUrl;
    else delete newConfig.baseUrl;
    if (data.apiKey && data.apiKey !== "••••••••") newConfig.apiKey = data.apiKey;
    else if (!data.apiKey) delete newConfig.apiKey;
    if (data.dataPath) newConfig.dataPath = data.dataPath;
    else delete newConfig.dataPath;
    if (data.sourceIdField) newConfig.sourceIdField = data.sourceIdField;
    else delete newConfig.sourceIdField;
    if (data.paginationType) newConfig.paginationType = data.paginationType;
    else delete newConfig.paginationType;
    if (data.pageSize) newConfig.pageSize = parseInt(data.pageSize, 10) || 100;
    else delete newConfig.pageSize;
    if (data.schoolId) newConfig.schoolId = data.schoolId;
    else delete newConfig.schoolId;

    updateMutation.mutate({
      name: data.name,
      type: data.type,
      config: newConfig,
      scheduleCron: data.scheduleCron || null,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input
                    data-testid="input-config-name"
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-config-type">
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
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="baseUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL Base</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://api.exemplo.com"
                    data-testid="input-config-url"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chave API</FormLabel>
                <FormControl>
                  <SecureInput
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="sk-..."
                    testId="input-config-apikey"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dataPath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caminho dos dados (JSON Path)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="data.results"
                    data-testid="input-config-datapath"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sourceIdField"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campo de ID na origem</FormLabel>
                <FormControl>
                  <Input
                    placeholder="id"
                    data-testid="input-config-sourceid"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="paginationType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de paginação</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || "none"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger data-testid="select-config-pagination">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="offset">Offset</SelectItem>
                      <SelectItem value="cursor">Cursor</SelectItem>
                      <SelectItem value="page">Página</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pageSize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tamanho da página</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="100"
                    data-testid="input-config-pagesize"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="scheduleCron"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agendamento Cron</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0 */6 * * *"
                    className="font-mono"
                    data-testid="input-config-cron"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="schoolId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Escola vinculada</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(v) =>
                      field.onChange(v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger data-testid="select-config-school">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {(schools || []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              checked={connector?.isActive ?? true}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ isActive: checked })
              }
              data-testid="switch-config-active"
            />
            <Label className="text-sm">
              {connector?.isActive ? "Conector ativo" : "Conector inativo"}
            </Label>
          </div>
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-save-config"
          >
            {updateMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configuração
          </Button>
        </div>
      </form>
    </Form>
  );
}

function MappingsTab({ connectorId }: { connectorId: string }) {
  const { user } = useAuth();
  const { data: mappings, isLoading } = useConnectorMappings(connectorId);
  const createMapping = useCreateMapping(connectorId);
  const updateMapping = useUpdateMapping(connectorId);
  const deleteMapping = useDeleteMapping(connectorId);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editMapping, setEditMapping] = useState<ConnectorMapping | null>(null);

  const isAdmin = user?.role === "admin";

  const addForm = useForm<MappingFormValues>({
    resolver: zodResolver(mappingSchema),
    defaultValues: { sourcePath: "", targetField: "", transformJson: "" },
  });

  const editForm = useForm<MappingFormValues>({
    resolver: zodResolver(mappingSchema),
    values: editMapping
      ? {
          sourcePath: editMapping.sourcePath,
          targetField: editMapping.targetField,
          transformJson: editMapping.transform
            ? JSON.stringify(editMapping.transform, null, 2)
            : "",
        }
      : { sourcePath: "", targetField: "", transformJson: "" },
  });

  function handleAdd(data: MappingFormValues) {
    createMapping.mutate(
      {
        sourcePath: data.sourcePath,
        targetField: data.targetField,
        transform: parseTransformJson(data.transformJson),
      },
      {
        onSuccess: () => {
          setAddDialogOpen(false);
          addForm.reset();
        },
      }
    );
  }

  function handleEdit(data: MappingFormValues) {
    if (!editMapping) return;
    updateMapping.mutate(
      {
        mappingId: editMapping.id,
        data: {
          sourcePath: data.sourcePath,
          targetField: data.targetField,
          transform: parseTransformJson(data.transformJson),
        },
      },
      { onSuccess: () => setEditMapping(null) }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {mappings?.length || 0} mapeamento(s) configurado(s)
        </p>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-mapping">
              <Plus className="h-4 w-4 mr-2" />
              Novo Mapeamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Mapeamento</DialogTitle>
              <DialogDescription>
                Defina a relação entre o campo de origem e o campo de destino
              </DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <form
                onSubmit={addForm.handleSubmit(handleAdd)}
                className="space-y-4"
              >
                <FormField
                  control={addForm.control}
                  name="sourcePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caminho de origem</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="data.nome_completo"
                          data-testid="input-mapping-source"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="targetField"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campo de destino</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="full_name"
                          data-testid="input-mapping-target"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="transformJson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transformação (JSON, opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={'{"op": "lowercase"}'}
                          className="font-mono text-sm resize-none min-h-[100px]"
                          data-testid="input-mapping-transform"
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
                  disabled={createMapping.isPending}
                  data-testid="button-submit-mapping"
                >
                  {createMapping.isPending ? "Salvando..." : "Criar Mapeamento"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {(!mappings || mappings.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ArrowRightLeft className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum mapeamento configurado
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Transformação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.id} data-testid={`row-mapping-${m.id}`}>
                  <TableCell>
                    <code
                      className="text-sm bg-muted px-1.5 py-0.5 rounded"
                      data-testid={`text-mapping-source-${m.id}`}
                    >
                      {m.sourcePath}
                    </code>
                  </TableCell>
                  <TableCell>
                    <code
                      className="text-sm bg-muted px-1.5 py-0.5 rounded"
                      data-testid={`text-mapping-target-${m.id}`}
                    >
                      {m.targetField}
                    </code>
                  </TableCell>
                  <TableCell>
                    {m.transform ? (
                      <Badge variant="secondary" data-testid={`badge-transform-${m.id}`}>
                        {(m.transform as Record<string, unknown>).op
                          ? String((m.transform as Record<string, unknown>).op)
                          : "custom"}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditMapping(m)}
                            data-testid={`button-edit-mapping-${m.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMapping.mutate(m.id)}
                            data-testid={`button-delete-mapping-${m.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editMapping} onOpenChange={(open) => !open && setEditMapping(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Mapeamento</DialogTitle>
            <DialogDescription>
              Altere os campos de origem, destino e transformação
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEdit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="sourcePath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caminho de origem</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-edit-mapping-source"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="targetField"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campo de destino</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-edit-mapping-target"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="transformJson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transformação (JSON, opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        className="font-mono text-sm resize-none min-h-[100px]"
                        data-testid="input-edit-mapping-transform"
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
                disabled={updateMapping.isPending}
                data-testid="button-submit-edit-mapping"
              >
                {updateMapping.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function SyncRunsTab({ connectorId }: { connectorId: string }) {
  const { user } = useAuth();
  const { data: runs, isLoading } = useSyncRuns(connectorId);
  const { data: files } = useRawIngestFiles(connectorId);
  const runMutation = useRunConnector(connectorId);

  const isAdmin = user?.role === "admin";
  const isOps = user?.role === "ops";
  const canRun = isAdmin || isOps;

  const [errorDetail, setErrorDetail] = useState<SyncRun | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const sortedRuns = [...(runs || [])].sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {sortedRuns.length} execução(ões) registrada(s)
        </p>
        {canRun && (
          <Button
            size="sm"
            onClick={() => runMutation.mutate({})}
            disabled={runMutation.isPending}
            data-testid="button-run-sync"
          >
            {runMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Executar agora
          </Button>
        )}
      </div>

      {sortedRuns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhuma execução registrada
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRuns.map((run) => {
                const sc =
                  STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
                const StatusIcon = sc.icon;
                const hasError =
                  run.error &&
                  Object.keys(run.error as Record<string, unknown>).length > 0;
                return (
                  <TableRow
                    key={run.id}
                    data-testid={`row-sync-run-${run.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon
                          className={`h-4 w-4 ${sc.className} ${run.status === "running" ? "animate-spin" : ""}`}
                        />
                        <span
                          className="text-sm"
                          data-testid={`text-run-status-${run.id}`}
                        >
                          {sc.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-sm"
                        data-testid={`text-run-started-${run.id}`}
                      >
                        {formatDate(run.startedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(run.startedAt, run.finishedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-sm font-mono"
                        data-testid={`text-run-in-${run.id}`}
                      >
                        {run.recordsIn ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-sm font-mono"
                        data-testid={`text-run-out-${run.id}`}
                      >
                        {run.recordsOut ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {hasError && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setErrorDetail(run)}
                                data-testid={`button-view-error-${run.id}`}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalhes</TooltipContent>
                          </Tooltip>
                        )}
                        {canRun && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={runMutation.isPending}
                                onClick={() => runMutation.mutate({})}
                                data-testid={`button-rerun-${run.id}`}
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${runMutation.isPending ? "animate-spin" : ""}`}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Re-executar</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {files && files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Arquivos brutos ({files.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Processado</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((f) => (
                    <TableRow key={f.id} data-testid={`row-file-${f.id}`}>
                      <TableCell>
                        <span className="text-sm font-mono">
                          {f.fileName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {f.fileSize
                            ? `${(f.fileSize / 1024).toFixed(1)} KB`
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {f.processed ? (
                          <Badge variant="secondary">Sim</Badge>
                        ) : (
                          <Badge variant="outline">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(f.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!errorDetail}
        onOpenChange={(open) => !open && setErrorDetail(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da execução</DialogTitle>
            <DialogDescription>
              Informações sobre erros e campos não mapeados
            </DialogDescription>
          </DialogHeader>
          {errorDetail?.error && (
            <pre
              className="text-xs bg-muted p-3 rounded overflow-auto max-h-[400px] font-mono"
              data-testid="text-error-detail"
            >
              {JSON.stringify(errorDetail.error, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function IntegrationDetailPage() {
  const [, params] = useRoute("/integrations/:id");
  const connectorId = params?.id;
  const { data: connector, isLoading } = useConnector(connectorId);

  if (!connectorId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Conector não encontrado</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!connector) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/integrations">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
        <p className="text-muted-foreground">Conector não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" asChild data-testid="button-back">
          <Link href="/integrations">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1
            className="text-2xl font-bold tracking-tight truncate"
            data-testid="text-connector-name"
          >
            {connector.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              data-testid="badge-connector-type"
            >
              {TYPE_LABELS[connector.type] || connector.type}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Criado em {formatDate(connector.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList data-testid="tabs-connector">
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings className="h-4 w-4 mr-2" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Mapeamentos
          </TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs">
            <Play className="h-4 w-4 mr-2" />
            Execuções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardContent className="pt-6">
              <ConfigTab connectorId={connectorId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings">
          <Card>
            <CardContent className="pt-6">
              <MappingsTab connectorId={connectorId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardContent className="pt-6">
              <SyncRunsTab connectorId={connectorId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
