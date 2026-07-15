import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./hooks/use-theme";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { Toaster } from "@/components/ui/toaster";

import AppLayout from "./components/layout/AppLayout";
import Home from "./pages/home";
import SignInPage from "./pages/sign-in";
import SignUpPage from "./pages/sign-up";
import Dashboard from "./pages/dashboard";
import ProjectsList from "./pages/projects/index";
import ProjectDetail from "./pages/projects/detail";
import OrganizationsList from "./pages/organizations/index";
import TeamList from "./pages/team/index";
import Settings from "./pages/settings/index";
import NotFound from "./pages/not-found";

function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <Home />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/sign-in" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/projects"><ProtectedRoute component={ProjectsList} /></Route>
      <Route path="/projects/:id"><ProtectedRoute component={ProjectDetail} /></Route>
      <Route path="/organizations"><ProtectedRoute component={OrganizationsList} /></Route>
      <Route path="/team"><ProtectedRoute component={TeamList} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </QueryClientProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
