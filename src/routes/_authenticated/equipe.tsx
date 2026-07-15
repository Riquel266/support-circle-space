import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const API_URL = () => `/api`;

export const Route = createFileRoute("/_authenticated/equipe")({
  component: EquipePage,
});

function EquipePage() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);

  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/caregivers`);
      const data = await res.json();
      return data.sort((a: any, b: any) =>
        (a.full_name || "").localeCompare(b.full_name || ""),
      );
    },
  });

  const addCaregiver = useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      photo_url: string | null;
      role?: string;
    }) => {
      const newCg = {
        id: generateId(),
        full_name: input.fullName,
        phone: input.phone || null,
        email: input.email,
        password: input.password,
        photo_url: input.photo_url,
        role: input.role || "cuidador",
        created_at: new Date().toISOString(),
      };
      const res = await fetch(`${API_URL()}/caregivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCg),
      });
      if (!res.ok) throw new Error("Erro ao cadastrar cuidador");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caregivers"] });
      toast.success("Cuidador cadastrado!");
      setPhotoUrl(null);
      setOpen(false);
    },
    onError: (err: Error) =>
      toast.error(err.message || "Erro ao cadastrar cuidador."),
  });

  const deleteCaregiver = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL()}/caregivers?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao excluir.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caregivers"] });
      toast.success("Cuidador excluido!");
    },
    onError: (err: Error) =>
      toast.error(err.message || "Nao foi possivel excluir."),
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    addCaregiver.mutate({
      fullName: String(form.get("full_name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      phone: String(form.get("phone") ?? "").trim() || undefined,
      photo_url: photoUrl,
      role: isSupervisor ? "supervisor" : "cuidador",
    });
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Equipe de Cuidadores</h1>
        {role === "supervisor" && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPhotoUrl(null); setIsSupervisor(false); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="mr-1 h-4 w-4" /> Novo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Cadastrar cuidador</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="flex flex-col items-center space-y-1.5">
                  <Label className="self-start">Foto do cuidador</Label>
                  <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/30 bg-secondary transition-colors hover:border-primary/50">
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                        <Camera className="h-6 w-6" />
                        <span>Adicionar</span>
                      </div>
                    )}
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cg-name">Nome completo</Label>
                  <Input id="cg-name" name="full_name" required maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cg-email">E-mail</Label>
                  <Input id="cg-email" name="email" type="email" required maxLength={255} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cg-password">Senha</Label>
                  <Input id="cg-password" name="password" type="text" required minLength={6} maxLength={72} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cg-phone">Telefone (opcional)</Label>
                  <Input id="cg-phone" name="phone" maxLength={30} />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cg-supervisor"
                    checked={isSupervisor}
                    onCheckedChange={(checked) => setIsSupervisor(checked === true)}
                  />
                  <Label htmlFor="cg-supervisor" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Acesso de supervisor
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={addCaregiver.isPending}>
                  {addCaregiver.isPending ? "Cadastrando..." : "Cadastrar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {caregivers?.map((cg: any) => (
          <Card key={cg.id} className="overflow-hidden transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
              {cg.photo_url ? (
                <img
                  src={cg.photo_url}
                  alt={cg.full_name}
                  className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-2xl font-bold text-primary">
                  {cg.full_name.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-semibold">{cg.full_name}</p>
                {cg.role === "supervisor" && (
                  <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Supervisor
                  </span>
                )}
                {cg.email && (
                  <p className="text-xs text-muted-foreground">{cg.email}</p>
                )}
                {cg.phone && (
                  <p className="text-xs text-muted-foreground">{cg.phone}</p>
                )}
              </div>
              {role === "supervisor" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (window.confirm(`Excluir ${cg.full_name}?`)) {
                      deleteCaregiver.mutate(cg.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {caregivers && caregivers.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum cuidador cadastrado ainda.
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
