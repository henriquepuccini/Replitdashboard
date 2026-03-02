import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useSchools } from "@/hooks/use-connectors";
import {
    useManualInputs,
    useUpsertManualInput,
    useDeleteManualInput,
} from "@/hooks/use-manual-input";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PencilLine, Trash2, Plus, DatabaseZap } from "lucide-react";
import type { ManualInput } from "@/hooks/use-manual-input";

// ─── Predefined metric keys ────────────────────────────────────────────────────
const METRIC_OPTIONS = [
    { value: "custo_marketing", label: "Custo de Marketing" },
    { value: "capacidade_turma", label: "Capacidade da Turma" },
    { value: "receita_prevista", label: "Receita Prevista" },
    { value: "outros", label: "Outros" },
];

// ─── Client-side Zod schema ────────────────────────────────────────────────────
const formSchema = z.object({
    chaveMetrica: z.string().min(1, "Métrica é obrigatória"),
    dataReferencia: z
        .string()
        .regex(/^\d{4}-\d{2}$/, "Use o formato AAAA-MM")
        .transform((v) => `${v}-01`),       // first of the month
    schoolId: z.string().optional(),
    valor: z
        .string()
        .min(1, "Valor é obrigatório")
        .refine((v) => !isNaN(parseFloat(v.replace(",", "."))), {
            message: "Valor deve ser um número",
        }),
    notas: z.string().optional(),
});

type FormValues = z.input<typeof formSchema>;

// ─── Formatting helpers ────────────────────────────────────────────────────────
function formatBRL(valor: string) {
    const n = parseFloat(valor);
    if (isNaN(n)) return valor;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function labelFor(key: string) {
    return METRIC_OPTIONS.find((m) => m.value === key)?.label ?? key;
}

// ─── Page component ────────────────────────────────────────────────────────────
export default function ManualInputPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const { data: schools } = useSchools();
    const { data: inputs, isLoading } = useManualInputs();
    const upsertMutation = useUpsertManualInput();
    const deleteMutation = useDeleteManualInput();

    const [deleteTarget, setDeleteTarget] = useState<ManualInput | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            chaveMetrica: "custo_marketing",
            dataReferencia: new Date().toISOString().slice(0, 7), // AAAA-MM
            schoolId: "",
            valor: "",
            notas: "",
        },
    });

    function handleSubmit(values: FormValues) {
        const transformed = formSchema.parse(values);
        upsertMutation.mutate(
            {
                chaveMetrica: transformed.chaveMetrica,
                dataReferencia: transformed.dataReferencia,
                schoolId: values.schoolId || null,
                valor: parseFloat(values.valor.replace(",", ".")),
                notas: values.notas || null,
            },
            {
                onSuccess: () => form.reset(form.getValues()),
            }
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1
                    className="text-2xl font-bold tracking-tight"
                    data-testid="text-manual-input-title"
                >
                    Entrada Manual de Dados
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Insira custos de marketing, capacidades de turma e outros valores
                    operacionais usados nos cálculos de KPIs.
                </p>
            </div>

            {/* Form card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Salvar valor
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(handleSubmit)}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            {/* Métrica */}
                            <FormField
                                control={form.control}
                                name="chaveMetrica"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Métrica</FormLabel>
                                        <FormControl>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger data-testid="select-chave-metrica">
                                                    <SelectValue placeholder="Selecione a métrica" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {METRIC_OPTIONS.map((m) => (
                                                        <SelectItem key={m.value} value={m.value}>
                                                            {m.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Mês/Ano */}
                            <FormField
                                control={form.control}
                                name="dataReferencia"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mês / Ano</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="month"
                                                data-testid="input-data-referencia"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Escola */}
                            <FormField
                                control={form.control}
                                name="schoolId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Escola (opcional)</FormLabel>
                                        <FormControl>
                                            <Select
                                                value={field.value || "__all__"}
                                                onValueChange={(v) =>
                                                    field.onChange(v === "__all__" ? "" : v)
                                                }
                                            >
                                                <SelectTrigger data-testid="select-school">
                                                    <SelectValue placeholder="Todas as escolas" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__all__">Toda a rede</SelectItem>
                                                    {(schools ?? []).map((s) => (
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

                            {/* Valor */}
                            <FormField
                                control={form.control}
                                name="valor"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0,00"
                                                data-testid="input-valor"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Notas */}
                            <FormField
                                control={form.control}
                                name="notas"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-2 lg:col-span-2">
                                        <FormLabel>Notas (opcional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Observações adicionais…"
                                                className="resize-none h-9"
                                                data-testid="textarea-notas"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={upsertMutation.isPending}
                                    data-testid="button-submit-manual-input"
                                >
                                    {upsertMutation.isPending ? "Salvando…" : "Salvar"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Table card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <DatabaseZap className="h-4 w-4" />
                        Dados registrados ({inputs?.length ?? 0})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : !inputs?.length ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <PencilLine className="h-10 w-10 text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Nenhum dado manual registrado ainda
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Métrica</TableHead>
                                        <TableHead>Mês</TableHead>
                                        <TableHead>Escola</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead>Notas</TableHead>
                                        {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inputs.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            data-testid={`row-manual-input-${row.id}`}
                                        >
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {labelFor(row.chaveMetrica)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm tabular-nums">
                                                {row.dataReferencia?.slice(0, 7)}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {schools?.find((s) => s.id === row.schoolId)?.name ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm">
                                                {formatBRL(row.valor)}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                {row.notas ?? "—"}
                                            </TableCell>
                                            {isAdmin && (
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => setDeleteTarget(row)}
                                                        disabled={deleteMutation.isPending}
                                                        data-testid={`button-delete-manual-${row.id}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete confirmation dialog */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir dado manual</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o registro de{" "}
                            <strong>{labelFor(deleteTarget?.chaveMetrica ?? "")}</strong> de{" "}
                            <strong>{deleteTarget?.dataReferencia?.slice(0, 7)}</strong>?
                            Esta ação não pode ser desfeita.
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
