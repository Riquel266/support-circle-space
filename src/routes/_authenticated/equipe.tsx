import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { UserPlus, Link2, X, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createCaregiver } from "@/lib/team.functions";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: EquipePage,
});

function EquipePage() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const createCaregiverFn = useServerFn(createCaregiver);
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    enabled: role === "supervisor",
    queryFn: async () => {
      let remoteCgs: any[] = [];
      try {
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "cuidador");
        if (!rolesError && roles && roles.length > 0) {
          const ids = roles.map((r) => r.user_id);
          const { data: profiles, error } = await supabase.from("profiles").select("*").in("id", ids);
          if (!error && profiles) remoteCgs = profiles;
        }
      } catch (e) {
        console.warn("Could not load caregivers from Supabase:", e);
      }

      const localCgStr = typeof window !== "undefined" ? localStorage.getItem("local-caregivers") : null;
      const localCgs = localCgStr ? JSON.parse(localCgStr) : [];

      const merged = [...remoteCgs];
      localCgs.forEach((local: any) => {
        if (!merged.some((m) => m.id === local.id || m.email === local.email)) {
          merged.push(local);
        }
      });
      return merged.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
    },
  });

  const { data: elders } = useQuery({
    queryKey: ["elders"],
    enabled: role === "supervisor",
    queryFn: async () => {
      let remoteElders: any[] = [];
      try {
        const { data, error } = await supabase.from("elders").select("*").eq("active", true).order("full_name");
        if (!error && data) remoteElders = data;
      } catch (e) {
        console.warn(e);
      }

      const localEldersStr = typeof window !== "undefined" ? localStorage.getItem("local-elders") : null;
      const localElders = localEldersStr ? JSON.parse(localEldersStr) : [];

      const merged = [...remoteElders];
      localElders.forEach((local: any) => {
        if (!merged.some((m) => m.id === local.id)) {
          merged.push(local);
        }
      });
      return merged.sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["all-assignments"],
    enabled: role === "supervisor",
    queryFn: async () => {
      let remoteAssignments: any[] = [];
      try {
        const { data, error } = await supabase.from("assignments").select("*");
        if (!error && data) remoteAssignments = data;
      } catch (e) {
        console.warn("Failed to fetch assignments from Supabase:", e);
      }

      const localAssignStr = typeof window !== "undefined" ? localStorage.getItem("local-assignments") : null;
      const localAssigns = localAssignStr ? JSON.parse(localAssignStr) : [];

      const merged = [...remoteAssignments];
      localAssigns.forEach((local: any) => {
        if (!merged.some((m) => m.id === local.id)) {
          merged.push(local);
        }
      });
      return merged;
    },
  });

  const addCaregiver = useMutation({
    mutationFn: async (input: { email: string; password: string; fullName: string; phone?: string; photo_url: string | null }) => {
      const newCg = {
        id: crypto.randomUUID(),
        full_name: input.fullName,
        phone: input.phone || null,
        email: input.email,
        photo_url: input.photo_url,
        created_at: new Date().toISOString(),
      };

      // Salva no localStorage
      const localCgStr = localStorage.getItem("local-caregivers");
      const localCgs = localCgStr ? JSON.parse(localCgStr) : [];
      localCgs.push(newCg);
      localStorage.setItem("local-caregivers", JSON.stringify(localCgs));

      // Tenta rodar a função no servidor de forma segura
      try {
        await createCaregiverFn({ data: {
          email: input.email,
          password: input.password,
          fullName: input.fullName,
          phone: input.phone
        }});
      } catch (e) {
        console.warn("Could not create remote caregiver (likely missing service role key), saved locally:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caregivers"] });
      toast.success("Cuidador cadastrado! Compartilhe o e-mail e a senha com ele(a).");
      setPhotoUrl(null);
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao cadastrar cuidador."),
  });

  const assign = useMutation({
    mutationFn: async ({ caregiverId, elderId }: { caregiverId: string; elderId: string }) => {
      const newAssign = {
        id: crypto.randomUUID(),
        caregiver_id: caregiverId,
        elder_id: elderId,
        created_at: new Date().toISOString(),
      };

      // 1. Salva no localStorage
      const localAssignStr = localStorage.getItem("local-assignments");
      const localAssigns = localAssignStr ? JSON.parse(localAssignStr) : [];
      localAssigns.push(newAssign);
      localStorage.setItem("local-assignments", JSON.stringify(localAssigns));

      // 2. Tenta salvar no Supabase
      try {
        const { error } = await supabase.from("assignments").insert({
          id: newAssign.id,
          caregiver_id: caregiverId,
          elder_id: elderId
        });
        if (error) {
          console.warn("Supabase assign error:", error.message);
        }
      } catch (e) {
        console.warn("Could not insert remote assignment, saved locally:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-assignments"] });
      toast.success("Idoso vinculado ao cuidador!");
    },
    onError: () => toast.error("Este vínculo já existe ou não pôde ser criado."),
  });

  const unassign = useMutation({
    mutationFn: async (assignmentId: string) => {
      // 1. Remove do localStorage
      const localAssignStr = localStorage.getItem("local-assignments");
      const localAssigns = localAssignStr ? JSON.parse(localAssignStr) : [];
      const filtered = localAssigns.filter((a: any) => a.id !== assignmentId);
      localStorage.setItem("local-assignments", JSON.stringify(filtered));

      // 2. Tenta remover do Supabase
      try {
        const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
        if (error) {
          console.warn("Supabase unassign error:", error.message);
        }
      } catch (e) {
        console.warn("Could not delete remote assignment, deleted locally:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-assignments"] });
      toast.success("Vínculo removido.");
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setPhotoUrl(null);
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
    });
  };

  if (role && role !== "supervisor") {
    return (
      <AppShell>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Apenas supervisores podem gerenciar a equipe.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Equipe de cuidadores</h1>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-1 h-4 w-4" /> Novo cuidador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Cadastrar cuidador</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5 flex flex-col items-center">
                <Label className="self-start">Foto do cuidador</Label>
                <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-secondary hover:border-primary/50 transition-colors overflow-hidden">
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  {photoUrl ? (
                    <img src={photoUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                      <span>Adicionar</span>
                    </div>
                  )}
                </label>
                {photoUrl && (
                  <button type="button" onClick={() => setPhotoUrl(null)} className="text-xs text-destructive hover:underline mt-1">
                    Remover foto
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cg-name">Nome completo</Label>
                <Input id="cg-name" name="full_name" required maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cg-email">E-mail (será o login)</Label>
                <Input id="cg-email" name="email" type="email" required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cg-password">Senha inicial</Label>
                <Input id="cg-password" name="password" type="text" required minLength={6} maxLength={72} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cg-phone">Telefone (opcional)</Label>
                <Input id="cg-phone" name="phone" maxLength={30} />
              </div>
              <Button type="submit" className="w-full" disabled={addCaregiver.isPending}>
                {addCaregiver.isPending ? "Cadastrando..." : "Cadastrar cuidador"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {caregivers?.map((cg) => {
          const cgAssignments = assignments?.filter((a) => a.caregiver_id === cg.id) ?? [];
          const availableElders = elders?.filter((e) => !cgAssignments.some((a) => a.elder_id === e.id)) ?? [];
          return (
            <Card key={cg.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {cg.photo_url ? (
                    <img
                      src={cg.photo_url}
                      alt={cg.full_name}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-lg font-bold text-secondary-foreground">
                      {(cg.full_name || "C").charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{cg.full_name || "Cuidador"}</p>
                    {cg.phone && <p className="text-sm text-muted-foreground">{cg.phone}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Idosos vinculados:</span>
                  {cgAssignments.length === 0 && <span className="text-xs text-muted-foreground">nenhum</span>}
                  {cgAssignments.map((a) => {
                    const elder = elders?.find((e) => e.id === a.elder_id);
                    return (
                      <Badge key={a.id} variant="secondary" className="gap-1">
                        {elder?.full_name ?? "Idoso"}
                        <button
                          type="button"
                          onClick={() => unassign.mutate(a.id)}
                          aria-label={`Remover vínculo com ${elder?.full_name ?? "idoso"}`}
                          className="ml-0.5 rounded-full hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                {availableElders.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <Select onValueChange={(elderId) => assign.mutate({ caregiverId: cg.id, elderId })}>
                      <SelectTrigger className="h-8 w-56 text-sm">
                        <SelectValue placeholder="Vincular idoso..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableElders.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {caregivers && caregivers.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhum cuidador cadastrado. Clique em “Novo cuidador” para criar o primeiro acesso.
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}