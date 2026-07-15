import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, ChevronRight, Camera, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { generateId } from "@/lib/utils";

const API_URL = () => `/api`;

export const Route = createFileRoute("/_authenticated/idosos/")({
  component: IdososPage,
});

function IdososPage() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: elders } = useQuery({
    queryKey: ["elders-list"],
    queryFn: async () => {
      const res = await fetch(`${API_URL()}/elders`);
      const data = await res.json();
      return data.sort((a: any, b: any) =>
        (a.full_name || "").localeCompare(b.full_name || ""),
      );
    },
  });

  const addElder = useMutation({
    mutationFn: async (payload: {
      full_name: string;
      birth_date: string | null;
      medical_notes: string | null;
      photo_url: string | null;
    }) => {
      const newElder = {
        id: generateId(),
        ...payload,
        active: true,
        created_at: new Date().toISOString(),
      };
      const res = await fetch(`${API_URL()}/elders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newElder),
      });
      if (!res.ok) throw new Error("Erro ao salvar no servidor.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elders-list"] });
      toast.success("Paciente cadastrado!");
      setPhotoUrl(null);
      setOpen(false);
    },
    onError: (err: Error) =>
      toast.error(err.message || "Nao foi possivel cadastrar."),
  });

  const deleteElder = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL()}/elders?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao excluir.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elders-list"] });
      toast.success("Paciente excluido!");
    },
    onError: (err: Error) =>
      toast.error(err.message || "Nao foi possivel excluir."),
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
      toast.error("Informe o nome do paciente.");
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
        <h1 className="font-display text-2xl font-bold">Pacientes</h1>
        {role === "supervisor" && (
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-1 h-4 w-4" /> Cadastrar paciente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">
                  Cadastrar paciente
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="flex flex-col items-center space-y-1.5">
                  <Label className="self-start">Foto do paciente</Label>
                  <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/30 bg-secondary transition-colors hover:border-primary/50">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                        <Camera className="h-6 w-6 text-muted-foreground" />
                        <span>Adicionar</span>
                      </div>
                    )}
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl(null)}
                      className="mt-1 text-xs text-destructive hover:underline"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="elder-name">Nome completo</Label>
                  <Input
                    id="elder-name"
                    name="full_name"
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="elder-birth">Data de nascimento</Label>
                  <Input id="elder-birth" name="birth_date" type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="elder-notes">
                    Condicoes / observacoes medicas
                  </Label>
                  <Textarea
                    id="elder-notes"
                    name="medical_notes"
                    maxLength={2000}
                    rows={3}
                    placeholder="Ex.: Hipertensao, diabetes tipo 2..."
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addElder.isPending}
                >
                  {addElder.isPending ? "Salvando..." : "Cadastrar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {elders?.filter((e: any) =>
          !search || (e.full_name || "").toLowerCase().includes(search.toLowerCase()),
        ).map((elder: any) => (
          <div key={elder.id} className="mb-2">
            <Link
              to="/idosos/$elderId"
              params={{ elderId: elder.id }}
            >
              <Card className="transition-shadow hover:shadow-md">
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
                      {[
                        calcAge(elder.birth_date),
                        elder.medical_notes?.slice(0, 60),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {role === "supervisor" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.confirm(`Excluir ${elder.full_name}?`)) {
                          deleteElder.mutate(elder.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        ))}
        {elders && elders.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhum paciente cadastrado ainda.
            </CardContent>
          </Card>
        )}
        {elders && elders.length > 0 && elders.filter((e: any) =>
          !search || (e.full_name || "").toLowerCase().includes(search.toLowerCase()),
        ).length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhum paciente encontrado para "{search}".
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
