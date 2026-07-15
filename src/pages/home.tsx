import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card">
        <div className="text-xl font-bold tracking-tight text-primary">ProjeTeus</div>
        <div className="flex gap-4">
          <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors flex items-center">
            Entrar
          </Link>
          <Button asChild>
            <Link href="/sign-up">Criar conta</Link>
          </Button>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
          Gestão de projetos transparente e colaborativa.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl">
          Conectamos empresas contratadas e entes públicos em um ambiente único. 
          Acompanhe etapas, atribua tarefas e comunique-se com clareza e sem burocracia.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Button size="lg" asChild className="text-lg h-12 px-8">
            <Link href="/sign-up">Comece agora</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="text-lg h-12 px-8">
            <Link href="/sign-in">Acesse sua conta</Link>
          </Button>
        </div>
        
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-lg mb-4 text-primary font-bold text-xl">1</div>
            <h3 className="text-xl font-bold mb-2">Organize</h3>
            <p className="text-muted-foreground">Estruture projetos em etapas claras e defina responsáveis por cada entrega.</p>
          </div>
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-lg mb-4 text-primary font-bold text-xl">2</div>
            <h3 className="text-xl font-bold mb-2">Colabore</h3>
            <p className="text-muted-foreground">Comunicação direta em cada projeto. Tire dúvidas e valide entregas no mesmo lugar.</p>
          </div>
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-lg mb-4 text-primary font-bold text-xl">3</div>
            <h3 className="text-xl font-bold mb-2">Acompanhe</h3>
            <p className="text-muted-foreground">Visão geral do progresso para todas as partes envolvidas, com total transparência.</p>
          </div>
        </div>
      </main>
      
      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border">
        &copy; {new Date().getFullYear()} ProjeTeus. Todos os direitos reservados.
      </footer>
    </div>
  );
}
