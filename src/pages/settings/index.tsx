import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, useGetMe } from "@api/client";
import { useUpdateMyAccount } from "@api/members";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const updateProfile = useUpdateMyAccount();
  const updatePassword = useUpdateMyAccount();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (me) {
      setName(me.name);
      setEmail(me.email);
    }
  }, [me]);

  const invalidateMe = () => {
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setProfileError("Informe seu nome.");
      return;
    }
    if (!trimmedEmail) {
      setProfileError("Informe seu e-mail.");
      return;
    }

    const payload: { name?: string; email?: string } = {};
    if (trimmedName !== me?.name) payload.name = trimmedName;
    if (trimmedEmail !== me?.email) payload.email = trimmedEmail;

    if (!payload.name && !payload.email) return;

    updateProfile.mutate(payload, {
      onSuccess: () => {
        invalidateMe();
        toast({
          title: "Perfil atualizado",
          description: "Suas informações foram salvas com sucesso.",
        });
      },
      onError: (err) => {
        setProfileError(
          err instanceof Error ? err.message : "Não foi possível salvar o perfil.",
        );
      },
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Informe sua senha atual.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação não corresponde à nova senha.");
      return;
    }

    updatePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          toast({
            title: "Senha alterada",
            description: "Sua senha foi atualizada com sucesso.",
          });
        },
        onError: (err) => {
          setPasswordError(
            err instanceof Error ? err.message : "Não foi possível alterar a senha.",
          );
        },
      },
    );
  };

  if (!me) return <div className="p-8">Carregando...</div>;

  const profileChanged = name.trim() !== me.name || email.trim() !== me.email;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais e de acesso.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>
            Atualize seu nome e e-mail de acesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {name.substring(0, 2).toUpperCase() || me.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm text-muted-foreground">
                <p>Avatar gerado a partir do seu nome.</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Papel / Organização</Label>
                <Input
                  value={`${me.role.toUpperCase()} - ${me.organization?.name || "Sem organização"}`}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {profileError ? (
              <p className="text-sm text-destructive">{profileError}</p>
            ) : null}

            <Button type="submit" disabled={updateProfile.isPending || !profileChanged}>
              {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Senha</CardTitle>
          <CardDescription>
            Altere sua senha de acesso. É necessário informar a senha atual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {passwordError ? (
              <p className="text-sm text-destructive">{passwordError}</p>
            ) : null}

            <Button
              type="submit"
              disabled={
                updatePassword.isPending ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
            >
              {updatePassword.isPending ? "Alterando..." : "Alterar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
