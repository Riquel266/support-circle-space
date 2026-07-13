import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, ChevronRight, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { calcAge } from "@/lib/care";

export const Route = createFileRoute("/_authenticated/idosos/")({
  component: IdososPage,
});

function IdososPage() {
  const { role, userId } = useRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { data: elders } = useQuery({
    queryKey: ["elders-list", role, userId],
    enabled: !!role,
    queryFn: async () => {
      let remoteElders: any[] = [];
      try {
        const { data, error } = await supabase
          .from("elders")
          .select("*")
          .eq("active", true)
          .order("full_name");
        if (!error && data) {
          remoteElders = data;
        }
      } catch (e) {
        console.warn("Could not load from Supabase:", e);
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

  const addElder = useMutation({
    mutationFn: async (payload: { full_name: string; birth_date: string | null; medical_notes: string | null; photo_url: string | null }) => {
      const newElder = {
        id: crypto.randomUUID(),
        ...payload,
        active: true,
        created_by: userId || "0e7874c3-a937-4158-a0ab-949991be81b9",
        created_at: new Date().toISOString(),
      };

      // Salva no localStorage
      const localEldersStr = localStorage.getItem("local-elders");
      const localElders = localEldersStr ? JSON.parse(localEldersStr) : [];
      localElders.push(newElder);
      localStorage.setItem("local-elders", JSON.stringify(localElders));

      // Tenta salvar no Supabase
      try {
        const { error } = await supabase.from("elders").insert(newElder);
        if (error) {
          console.warn("Supabase insert warning:", error.message);
        }
      } catch (e) {
        console.warn("Failed to save to remote Supabase, saved locally:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elders-list"] });
      queryClient.invalidateQueries({ queryKey: ["elders"] });
      toast.success("Idoso cadastrado!");
      setPhotoUrl(null);
      setOpen(false);
    },
    onError: () => toast.error("Não foi possível cadastrar."),
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

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("full_name") ?? "").trim();
    if (name.length < 2) {
      toast.error("Informe o nome do idoso.");
      return;
    }
    addElder.mutate({
      full_name: name,
      birth_date: String(form.get("birth_date") ?? "") || null,
      medical_notes: String(form.get("medical_notes") ?? "").trim() || null,
      photo_url: photoUrl,
    });
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Idosos</h1>
        {role === "supervisor" && (
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-1 h-4 w-4" /> Cadastrar idoso
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Cadastrar idoso</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5 flex flex-col items-center">
                  <Label className="self-start">Foto do idoso</Label>
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
                  <Label htmlFor="elder-name">Nome completo</Label>
                  <Input id="elder-name" name="full_name" required maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="elder-birth">Data de nascimento</Label>
                  <Input id="elder-birth" name="birth_date" type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="elder-notes">Condições / observações médicas</Label>
                  <Textarea id="elder-notes" name="medical_notes" maxLength={2000} rows={3} placeholder="Ex.: Hipertensão, diabetes tipo 2..." />
                </div>
                <Button type="submit" className="w-full" disabled={addElder.isPending}>
                  {addElder.isPending ? "Salvando..." : "Cadastrar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-2">
        {elders?.map((elder) => (
          <Link key={elder.id} to="/idosos/$elderId" params={{ elderId: elder.id }}>
            <Card className="mb-2 transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                {elder.photo_url ? (
                  <img
                    src={elder.photo_url}
                    alt={elder.full_name}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-lg font-bold text-secondary-foreground">
                    {elder.full_name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{elder.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[calcAge(elder.birth_date), elder.medical_notes?.slice(0, 60)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {elders && elders.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {role === "supervisor"
                ? "Nenhum idoso cadastrado ainda. Clique em “Cadastrar idoso”."
                : "Nenhum idoso vinculado a você ainda."}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}