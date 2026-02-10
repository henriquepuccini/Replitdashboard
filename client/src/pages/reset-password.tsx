import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
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
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const resetSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

type ResetForm = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const form = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
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

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  function handleReset(data: ResetForm) {
    toast({
      title: "Link de recuperação enviado",
      description: `Se ${data.email} estiver cadastrado, você receberá um e-mail com instruções para redefinir sua senha.`,
    });
    form.reset();
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="text-reset-title"
          >
            Recuperar Senha
          </h1>
          <p className="text-sm text-muted-foreground">
            Informe seu e-mail para receber um link de recuperação
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Redefinir senha
            </CardTitle>
            <CardDescription>
              Um link será enviado para redefinição da senha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleReset)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="seu@email.com"
                          data-testid="input-reset-email"
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
                  data-testid="button-reset"
                >
                  Enviar link de recuperação
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
            data-testid="link-back-login"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para login
          </Link>
        </div>
      </div>
    </div>
  );
}
