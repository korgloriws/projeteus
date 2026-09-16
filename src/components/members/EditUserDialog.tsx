import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListUsersQueryKey, type UserProfileEnriched } from "@api/client";
import { useAdminUpdateUser } from "@api/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface EditUserDialogProps {
  user: UserProfileEnriched | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateUser = useAdminUpdateUser();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setEmail(user.email);
      setPassword("");
      setError(null);
    }
  }, [open, user]);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setPassword("");
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError("Informe o nome.");
      return;
    }
    if (!trimmedEmail) {
      setError("Informe o e-mail.");
      return;
    }
    if (password && password.length < 8) {
      setError("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }

    const payload: {
      id: number;
      name?: string;
      email?: string;
      password?: string;
    } = { id: user.id };
    if (trimmedName !== user.name) payload.name = trimmedName;
    if (trimmedEmail !== user.email) payload.email = trimmedEmail;
    if (password) payload.password = password;

    if (!payload.name && !payload.email && !payload.password) {
      handleOpenChange(false);
      return;
    }

    updateUser.mutate(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({
          title: "Usuário atualizado",
          description: password
            ? `Os dados de ${trimmedName} foram salvos e a senha foi redefinida.`
            : `Os dados de ${trimmedName} foram salvos.`,
        });
        handleOpenChange(false);
      },
      onError: (err) => {
        setError(
          err instanceof Error ? err.message : "Não foi possível salvar o usuário.",
        );
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Atualize nome e e-mail ou redefina a senha para recuperar o acesso da conta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-user-name">Nome</Label>
            <Input
              id="edit-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-user-email">E-mail</Label>
            <Input
              id="edit-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@organizacao.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-user-password">Nova senha (opcional)</Label>
            <Input
              id="edit-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="Deixe em branco para manter a senha atual"
              autoComplete="new-password"
            />
            <p className="text-[10px] text-muted-foreground">
              Preencha para redefinir a senha e recuperar o acesso do usuário.
            </p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
