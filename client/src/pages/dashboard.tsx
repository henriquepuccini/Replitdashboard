import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, School, Users } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          data-testid="text-dashboard-title"
        >
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo, {user?.fullName || user?.email}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Matrículas
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p
              className="text-2xl font-bold"
              data-testid="text-kpi-enrollments"
            >
              —
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Dados serão carregados após integração CRM
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p
              className="text-2xl font-bold"
              data-testid="text-kpi-revenue"
            >
              —
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Dados serão carregados após integração financeira
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Escolas
            </CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p
              className="text-2xl font-bold"
              data-testid="text-kpi-schools"
            >
              6
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Unidades ativas na rede
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversão
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p
              className="text-2xl font-bold"
              data-testid="text-kpi-conversion"
            >
              —
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Taxa de conversão de leads
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Comercial</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <div className="text-center space-y-2">
              <BarChart3 className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-sm">
                Os gráficos de performance serão exibidos após a integração com os dados do CRM
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
