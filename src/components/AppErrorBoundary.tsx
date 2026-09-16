import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string | null;
};

function isLikelyTranslateDomError(message: string | null): boolean {
  if (!message) return false;
  const msg = message.toLowerCase();
  return (
    msg.includes("removechild") ||
    msg.includes("insertbefore") ||
    msg.includes("not a child") ||
    msg.includes("the node before which the new node is to be inserted")
  );
}

/**
 * Recupera de crashes típicos quando a tradução do navegador altera o DOM
 * sob o React (tela branca).
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ProjeTeus] UI error:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleContinue = () => {
    this.setState({ hasError: false, message: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const translateHint = isLikelyTranslateDomError(this.state.message);

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">
            Algo interrompeu a interface
          </h1>
          <p className="text-sm text-muted-foreground">
            {translateHint
              ? "Isso costuma acontecer quando o navegador traduz a página automaticamente. O ProjeTeus já está em português — desative a tradução nesta aba e recarregue."
              : "Ocorreu um erro inesperado na interface. Você pode tentar continuar ou recarregar a página."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {!translateHint ? (
              <Button type="button" variant="outline" onClick={this.handleContinue}>
                Tentar continuar
              </Button>
            ) : null}
            <Button type="button" onClick={this.handleReload}>
              Recarregar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
