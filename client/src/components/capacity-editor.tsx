import { useState } from "react";
import { format } from "date-fns";
import { useSchoolCapacity, useCreateCapacity, useUpdateCapacity, useDeleteCapacity } from "@/hooks/use-capacity";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TURMAS = ["Berçário", "Maternal", "Jardim", "Pré-escola", "Fundamental I", "Fundamental II", "Ensino Médio"];

export function CapacityEditor({ schoolId }: { schoolId: string | undefined }) {
    const { user } = useAuth();
    const { toast } = useToast();

    const isAdmin = user?.role === "admin";
    const isDirector = user?.role === "director";
    const canEdit = isAdmin || isDirector;

    const { data: capacities, isLoading } = useSchoolCapacity(schoolId);
    const createCap = useCreateCapacity();
    const updateCap = useUpdateCapacity(schoolId || "");
    const deleteCap = useDeleteCapacity(schoolId || "");

    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        turma: TURMAS[0],
        legalCapacity: "",
        operationalCapacity: "",
        effectiveFrom: format(new Date(), "yyyy-MM-dd"),
        notes: ""
    });

    if (!schoolId) return null;

    const handleOpenNew = () => {
        setEditingId(null);
        setFormData({
            turma: TURMAS[0],
            legalCapacity: "",
            operationalCapacity: "",
            effectiveFrom: format(new Date(), "yyyy-MM-dd"),
            notes: ""
        });
        setIsOpen(true);
    };

    const handleOpenEdit = (cap: any) => {
        setEditingId(cap.id);
        setFormData({
            turma: cap.turma,
            legalCapacity: cap.legalCapacity.toString(),
            operationalCapacity: cap.operationalCapacity.toString(),
            effectiveFrom: format(new Date(cap.effectiveFrom), "yyyy-MM-dd"),
            notes: cap.notes || ""
        });
        setIsOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este registro de capacidade?")) return;
        try {
            await deleteCap.mutateAsync(id);
            toast({ title: "Capacidade excluída com sucesso" });
        } catch (e: any) {
            toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
        }
    };

    const handleSave = async () => {
        try {
            const payload = {
                schoolId,
                turma: formData.turma,
                legalCapacity: parseInt(formData.legalCapacity, 10),
                operationalCapacity: parseInt(formData.operationalCapacity, 10),
                effectiveFrom: formData.effectiveFrom,
                notes: formData.notes || null,
            };

            if (editingId) {
                await updateCap.mutateAsync({ id: editingId, data: payload });
                toast({ title: "Capacidade atualizada sucesso" });
            } else {
                await createCap.mutateAsync(payload);
                toast({ title: "Capacidade cadastrada com sucesso" });
            }
            setIsOpen(false);
        } catch (e: any) {
            toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">Configuração de Capacidade</CardTitle>
                    <CardDescription>
                        Gerencie a capacidade legal e operacional por turma.
                    </CardDescription>
                </div>
                {canEdit && (
                    <Button size="sm" onClick={handleOpenNew}>
                        <Plus className="h-4 w-4 mr-1.5" /> Adicionar
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : !capacities?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma capacidade cadastrada.</p>
                ) : (
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Turma</TableHead>
                                    <TableHead>Capacidade Legal</TableHead>
                                    <TableHead>Capacidade Operacional</TableHead>
                                    <TableHead>Válido a partir de</TableHead>
                                    <TableHead>Notas</TableHead>
                                    {canEdit && <TableHead className="w-[100px] text-right">Ações</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {capacities.map((cap) => (
                                    <TableRow key={cap.id}>
                                        <TableCell className="font-medium">{cap.turma}</TableCell>
                                        <TableCell>{cap.legalCapacity}</TableCell>
                                        <TableCell>{cap.operationalCapacity}</TableCell>
                                        <TableCell>{format(new Date(cap.effectiveFrom), "dd/MM/yyyy")}</TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={cap.notes || ""}>{cap.notes || "—"}</TableCell>
                                        {canEdit && (
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(cap)}>
                                                        <Pencil className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                    {isAdmin && (
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cap.id)}>
                                                            <Trash2 className="h-4 w-4 text-rose-500" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Editar" : "Nova"} Capacidade</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Turma</Label>
                            <Select value={formData.turma} onValueChange={(v) => setFormData({ ...formData, turma: v })}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Selecione a turma" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TURMAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Legal</Label>
                            <Input
                                type="number"
                                value={formData.legalCapacity}
                                onChange={(e) => setFormData({ ...formData, legalCapacity: e.target.value })}
                                className="col-span-3"
                                placeholder="Ex:: 30"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Operacional</Label>
                            <Input
                                type="number"
                                value={formData.operationalCapacity}
                                onChange={(e) => setFormData({ ...formData, operationalCapacity: e.target.value })}
                                className="col-span-3"
                                placeholder="Ex:: 25"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Data de vigência</Label>
                            <Input
                                type="date"
                                value={formData.effectiveFrom}
                                onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Notas</Label>
                            <Input
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="col-span-3"
                                placeholder="Ex: Reforma na sala"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={createCap.isPending || updateCap.isPending || !formData.legalCapacity || !formData.operationalCapacity}>
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
