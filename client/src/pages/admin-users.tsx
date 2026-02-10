import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User, School, UserSchool, UserRole } from "@shared/schema";
import { USER_ROLES } from "@shared/schema";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  Shield,
  Building2,
  Plus,
  Check,
  X,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director: "Diretor",
  seller: "Vendedor",
  exec: "Executivo",
  finance: "Financeiro",
  ops: "Operações",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  director: "bg-chart-1 text-primary-foreground",
  seller: "bg-chart-2 text-primary-foreground",
  exec: "bg-chart-4 text-primary-foreground",
  finance: "bg-chart-5 text-primary-foreground",
  ops: "bg-chart-3 text-primary-foreground",
};

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return (email || "?")[0].toUpperCase();
}

const addUserSchema = z.object({
  email: z.string().email("E-mail inválido"),
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: z.enum(USER_ROLES as unknown as [string, ...string[]]).default("seller"),
  schoolId: z.string().optional(),
});

type AddUserForm = z.infer<typeof addUserSchema>;

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: schools } = useQuery<School[]>({
    queryKey: ["/api/schools"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, { role });
      return res.json() as Promise<User>;
    },
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/users"] });
      const previous = queryClient.getQueryData<User[]>(["/api/users"]);
      queryClient.setQueryData<User[]>(["/api/users"], (old) =>
        old?.map((u) => (u.id === userId ? { ...u, role } : u))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/users"], context.previous);
      }
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao atualizar o cargo do usuário",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onSuccess: (data) => {
      toast({
        title: "Cargo atualizado",
        description: `${data.fullName || data.email} agora é ${ROLE_LABELS[data.role] || data.role}`,
      });
    },
  });

  const updateSchoolMutation = useMutation({
    mutationFn: async ({
      userId,
      schoolId,
    }: {
      userId: string;
      schoolId: string | null;
    }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, {
        schoolId,
      });
      return res.json() as Promise<User>;
    },
    onMutate: async ({ userId, schoolId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/users"] });
      const previous = queryClient.getQueryData<User[]>(["/api/users"]);
      queryClient.setQueryData<User[]>(["/api/users"], (old) =>
        old?.map((u) => (u.id === userId ? { ...u, schoolId } : u))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/users"], context.previous);
      }
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao atualizar a escola do usuário",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onSuccess: (data) => {
      const schoolName = schools?.find(
        (s) => s.id === data.schoolId
      )?.name;
      toast({
        title: "Escola atualizada",
        description: `${data.fullName || data.email} vinculado a ${schoolName || "nenhuma escola"}`,
      });
    },
  });

  const addUserForm = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      email: "",
      fullName: "",
      role: "seller",
      schoolId: "",
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (data: AddUserForm) => {
      const payload: Record<string, any> = {
        email: data.email,
        fullName: data.fullName,
        role: data.role,
      };
      if (data.schoolId) {
        payload.schoolId = data.schoolId;
      }
      const res = await apiRequest("POST", "/api/users", payload);
      return res.json() as Promise<User>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuário criado",
        description: `${data.fullName || data.email} foi adicionado`,
      });
      setAddDialogOpen(false);
      addUserForm.reset();
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar usuário",
        description: err.message,
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      userId,
      isActive,
    }: {
      userId: string;
      isActive: boolean;
    }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, {
        isActive,
      });
      return res.json() as Promise<User>;
    },
    onMutate: async ({ userId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/users"] });
      const previous = queryClient.getQueryData<User[]>(["/api/users"]);
      queryClient.setQueryData<User[]>(["/api/users"], (old) =>
        old?.map((u) => (u.id === userId ? { ...u, isActive } : u))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/users"], context.previous);
      }
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao alterar status do usuário",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onSuccess: (data) => {
      toast({
        title: data.isActive ? "Usuário ativado" : "Usuário desativado",
        description: `${data.fullName || data.email} foi ${data.isActive ? "ativado" : "desativado"}`,
      });
    },
  });

  function getSchoolName(schoolId: string | null): string {
    if (!schoolId || !schools) return "—";
    return schools.find((s) => s.id === schoolId)?.name || "—";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="text-admin-title"
          >
            Gerenciar Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os acessos, cargos e associações dos usuários
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados para criar um novo usuário no sistema
              </DialogDescription>
            </DialogHeader>
            <Form {...addUserForm}>
              <form
                onSubmit={addUserForm.handleSubmit((data) =>
                  addUserMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <FormField
                  control={addUserForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="João Silva"
                          data-testid="input-add-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addUserForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="joao@escola.com"
                          data-testid="input-add-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger data-testid="select-add-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {USER_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role] || role}
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
                  control={addUserForm.control}
                  name="schoolId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Escola (opcional)</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger data-testid="select-add-school">
                            <SelectValue placeholder="Selecione uma escola" />
                          </SelectTrigger>
                          <SelectContent>
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
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addUserMutation.isPending}
                  data-testid="button-submit-add-user"
                >
                  {addUserMutation.isPending
                    ? "Criando..."
                    : "Criar Usuário"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários ({users?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {usersLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5" /> Cargo
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> Escola
                      </span>
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users || []).map((u) => (
                    <TableRow
                      key={u.id}
                      data-testid={`row-user-${u.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={u.avatarUrl || undefined} />
                            <AvatarFallback>
                              {getInitials(u.fullName, u.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p
                              className="font-medium truncate"
                              data-testid={`text-user-name-${u.id}`}
                            >
                              {u.fullName || "Sem nome"}
                            </p>
                            <p
                              className="text-sm text-muted-foreground truncate"
                              data-testid={`text-user-email-${u.id}`}
                            >
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.id === currentUser?.id ? (
                          <Badge
                            className={ROLE_COLORS[u.role] || ""}
                            data-testid={`badge-role-${u.id}`}
                          >
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                        ) : (
                          <Select
                            value={u.role}
                            onValueChange={(role) =>
                              updateRoleMutation.mutate({
                                userId: u.id,
                                role,
                              })
                            }
                          >
                            <SelectTrigger
                              className="w-[140px]"
                              data-testid={`select-role-${u.id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {USER_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role] || role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.schoolId || "none"}
                          onValueChange={(val) =>
                            updateSchoolMutation.mutate({
                              userId: u.id,
                              schoolId: val === "none" ? null : val,
                            })
                          }
                        >
                          <SelectTrigger
                            className="w-[180px]"
                            data-testid={`select-school-${u.id}`}
                          >
                            <SelectValue
                              placeholder="Nenhuma"
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              Nenhuma
                            </SelectItem>
                            {(schools || []).map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.id !== currentUser?.id ? (
                          <Button
                            variant={u.isActive ? "outline" : "default"}
                            size="sm"
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                userId: u.id,
                                isActive: !u.isActive,
                              })
                            }
                            data-testid={`button-toggle-active-${u.id}`}
                          >
                            {u.isActive ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <X className="h-3.5 w-3.5 mr-1" />
                                Inativo
                              </>
                            )}
                          </Button>
                        ) : (
                          <Badge
                            variant="secondary"
                            data-testid={`badge-status-${u.id}`}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Você
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
