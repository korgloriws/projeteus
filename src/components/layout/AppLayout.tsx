import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = [
    { name: "Visão Geral", href: "/dashboard", icon: LayoutDashboard },
    { name: "Projetos", href: "/projects", icon: Briefcase },
    { name: "Organizações", href: "/organizations", icon: Building2 },
    { name: "Equipe", href: "/team", icon: Users },
  ];

  const renderSidebarBody = (onNavigate?: () => void) => (
    <>
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {user?.name || "Carregando..."}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {user?.role || ""}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <Link
            href="/settings"
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location === "/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
          </button>
          <button
            onClick={() => {
              onNavigate?.();
              logout().then(() => window.location.assign("/"));
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-red-500 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar fixa (desktop) */}
      <aside className="hidden md:flex md:w-64 border-r border-border bg-card flex-col md:min-h-screen sticky top-0 md:h-screen">
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-primary"
          >
            ProjeTeus
          </Link>
          <NotificationBell />
        </div>
        {renderSidebarBody()}
      </aside>

      {/* Top bar com menu (mobile) */}
      <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-card px-3">
        <div className="flex items-center gap-1">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 p-0 flex flex-col bg-card"
            >
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <div className="h-16 flex items-center px-6 border-b border-border">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="text-xl font-bold tracking-tight text-primary"
                >
                  ProjeTeus
                </Link>
              </div>
              {renderSidebarBody(() => setMobileOpen(false))}
            </SheetContent>
          </Sheet>
          <Link
            href="/dashboard"
            className="text-lg font-bold tracking-tight text-primary"
          >
            ProjeTeus
          </Link>
        </div>
        <NotificationBell />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
