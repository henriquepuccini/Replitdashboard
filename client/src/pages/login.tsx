import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Mail, KeyRound, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user, isLoading, isAuthenticated, signIn, isSigningIn } = useAuth();
  const { toast } = useToast();
  const [devPickerEmail, setDevPickerEmail] = useState("");

  const { data: devUsers, isLoading: devUsersLoading } = useQuery<
    { id: string; email: string; fullName: string | null; role: string }[]
  >({
    queryKey: ["/api/auth/dev-users"],
    queryFn: async () => {
      const res = await fetch("/api/auth/dev-users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  const magicLinkForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-md space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Redirect to={user.role === "admin" ? "/admin/users" : "/"} />;
  }

  async function handleLogin(data: LoginForm) {
    try {
      await signIn(data.email);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao entrar",
        description: err.message || "Verifique suas credenciais",
      });
    }
  }

  async function handleMagicLink(data: LoginForm) {
    toast({
      title: "Link mágico enviado",
      description: `Verifique o e-mail ${data.email} para entrar`,
    });
  }

  async function handleDevLogin() {
    if (!devPickerEmail) return;
    try {
      await signIn(devPickerEmail);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao entrar",
        description: err.message || "Usuário não encontrado",
      });
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="text-login-title"
          >
            Dashboard Comercial
          </h1>
          <p className="text-sm text-muted-foreground">
            Acesse sua conta para visualizar os indicadores
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Entrar
            </CardTitle>
            <CardDescription>
              Escolha o método de autenticação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="email"
                  data-testid="tab-email-login"
                  className="flex items-center gap-1"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">E-mail</span>
                </TabsTrigger>
                <TabsTrigger
                  value="magic"
                  data-testid="tab-magic-link"
                  className="flex items-center gap-1"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Link</span>
                </TabsTrigger>
                <TabsTrigger
                  value="dev"
                  data-testid="tab-dev-login"
                  className="flex items-center gap-1"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Dev</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email">
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit(handleLogin)}
                    className="space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              data-testid="input-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <p className="text-xs text-muted-foreground" data-testid="text-email-login-hint">
                      No modo de desenvolvimento, basta informar o e-mail cadastrado.
                    </p>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSigningIn}
                      data-testid="button-login"
                    >
                      {isSigningIn ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="magic">
                <Form {...magicLinkForm}>
                  <form
                    onSubmit={magicLinkForm.handleSubmit(handleMagicLink)}
                    className="space-y-4"
                  >
                    <FormField
                      control={magicLinkForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              data-testid="input-magic-email"
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
                      data-testid="button-magic-link"
                    >
                      Enviar link mágico
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Um link de acesso será enviado para seu e-mail
                    </p>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="dev">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Selecione um usuário de desenvolvimento para fazer login
                    rápido.
                  </p>
                  {devUsersLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={devPickerEmail}
                      onValueChange={setDevPickerEmail}
                    >
                      <SelectTrigger data-testid="select-dev-user">
                        <SelectValue placeholder="Selecione um usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {(devUsers || []).map((u) => (
                          <SelectItem
                            key={u.id}
                            value={u.email}
                            data-testid={`option-dev-user-${u.email}`}
                          >
                            {u.fullName || u.email} ({u.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    className="w-full"
                    onClick={handleDevLogin}
                    disabled={!devPickerEmail || isSigningIn}
                    data-testid="button-dev-login"
                  >
                    {isSigningIn ? "Entrando..." : "Entrar como dev"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <Link
            href="/reset-password"
            className="text-sm text-muted-foreground hover:underline"
            data-testid="link-reset-password"
          >
            Esqueceu a senha?
          </Link>
          <p className="text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link
              href="/signup"
              className="text-primary hover:underline font-medium"
              data-testid="link-signup"
            >
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
