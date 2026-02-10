import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Plug,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useState, useEffect } from "react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  director: "Diretor",
  seller: "Vendedor",
  exec: "Executivo",
  finance: "Financeiro",
  ops: "Operações",
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

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setDark(!dark)}
      data-testid="button-theme-toggle"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, isSigningOut } = useAuth();
  const [location] = useLocation();

  const isAdmin = user?.role === "admin";
  const isOps = user?.role === "ops";

  const menuItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      visible: true,
    },
    {
      title: "Integrações",
      url: "/integrations",
      icon: Plug,
      visible: isAdmin || isOps,
    },
    {
      title: "Usuários",
      url: "/admin/users",
      icon: Users,
      visible: isAdmin,
    },
  ];

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Dashboard Comercial</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems
                    .filter((item) => item.visible)
                    .map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.url === "/" ? location === "/" : location.startsWith(item.url)}
                          data-testid={`link-sidebar-${item.url === "/" ? "dashboard" : item.url.replace(/\//g, "-").slice(1)}`}
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(user?.fullName, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-medium truncate"
                    data-testid="text-sidebar-user-name"
                  >
                    {user?.fullName || user?.email}
                  </p>
                  <Badge variant="secondary" className="text-[10px]">
                    {ROLE_LABELS[user?.role || ""] || user?.role}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => signOut()}
                disabled={isSigningOut}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isSigningOut ? "Saindo..." : "Sair"}
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-3 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
