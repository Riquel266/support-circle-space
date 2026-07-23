import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, Camera, Trash2, Pencil, MapPin, Search } from "lucide-react";
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
import { AddressSearch } from "@/components/AddressSearch";
import { API_URL, companyFetch } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: EquipePage,
});

function EquipePage() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCg, setEditingCg] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [editIsSupervisor, setEditIsSupervisor] = useState(false);
  const [addAddress, setAddAddress] = useState("");
  const [addNumber, setAddNumber] = useState("");
  const [addCoords, setAddCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editAddress, setEditAddress] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editCoords, setEditCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [search, setSearch] = useState("");

  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const res = await companyFetch("/caregivers");
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
      location_address: string | null;
      location_lat: number | null;
      location_lng: number | null;
      location_radius: number;
    }) => {
      const newCg = {
        id: generateId(),
        full_name: input.fullName,
        phone: input.phone || null,
        email: input.email,
        password: input.password,
        photo_url: input.photo_url,
        role: input.role || "cuidador",
        location_address: input.location_address,
        location_lat: input.location_lat,
        location_lng: input.location_lng,
        location_radius: input.location_radius,
        created_at: new Date().toISOString(),
      };
      const res = await companyFetch("/caregivers", {
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
      const res = await companyFetch(`/caregivers?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao excluir.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caregivers"] });
      toast.success("Cuidador excluído!");
    },
    onError: (err: Error) =>
      toast.error(err.message || "Não foi possível excluir."),
  });

  const updateCaregiver = useMutation({
    mutationFn: async (payload: {
      id: string;
      full_name: string;
      email: string;
      password?: string;
      phone?: string;
      photo_url: string | null;
      role: string;
      location_address: string | null;
      location_lat: number | null;
      location_lng: number | null;
      location_radius: number;
    }) => {
      const res = await companyFetch("/caregivers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro ao atualizar.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caregivers"] });
      toast.success("Cuidador atualizado!");
      setEditOpen(false);
      setEditingCg(null);
      setEditPhotoUrl(null);
    },
    onError: (err: Error) =>
      toast.error(err.message || "Não foi possível atualizar."),
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
      location_address: addAddress || null,
      location_lat: addCoords?.lat ?? null,
      location_lng: addCoords?.lng ?? null,
      location_radius: Number(form.get("location_radius")) || 100,
    });
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCg) return;
    const form = new FormData(e.currentTarget);
    const payload: any = {
      id: editingCg.id,
      full_name: String(form.get("full_name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim() || null,
      photo_url: editPhotoUrl,
      role: editIsSupervisor ? "supervisor" : "cuidador",
      location_address: editAddress || null,
      location_lat: editCoords?.lat ?? null,
      location_lng: editCoords?.lng ?? null,
      location_radius: Number(form.get("location_radius")) || 100,
    };
    const pwd = String(form.get("password") ?? "");
    if (pwd) payload.password = pwd;
    updateCaregiver.mutate(payload);
  };

  const openEdit = (cg: any) => {
    setEditingCg(cg);
    setEditPhotoUrl(cg.photo_url || null);
    setEditIsSupervisor(cg.role === "supervisor");
    setEditAddress(cg.location_address || "");
    setEditCoords(
      cg.location_lat && cg.location_lng
        ? { lat: Number(cg.location_lat), lng: Number(cg.location_lng) }
        : null
    );
    setEditOpen(true);
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Equipe de Cuidadores</h1>
        {role === "supervisor" && (
          <>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPhotoUrl(null); setIsSupervisor(false); setAddAddress(""); setAddCoords(null); } }}>
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
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Localização de trabalho
                  </Label>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <AddressSearch
                      value={addAddress}
                      onChange={setAddAddress}
                      onCoordinates={(lat, lng) => setAddCoords({ lat, lng })}
                      placeholder="Rua, bairro, cidade"
                      number={addNumber}
                      onNumberChange={setAddNumber}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cg-radius" className="text-xs text-muted-foreground">Raio permitido (metros)</Label>
                    <Input id="cg-radius" name="location_radius" type="number" min="10" max="5000" defaultValue={100} />
                  </div>
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
          <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditingCg(null); setEditPhotoUrl(null); setEditAddress(""); setEditCoords(null); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Editar cuidador</DialogTitle>
              </DialogHeader>
              {editingCg && (
                <form onSubmit={handleEdit} className="space-y-4">
                  <div className="flex flex-col items-center space-y-1.5">
                    <Label className="self-start">Foto do cuidador</Label>
                    <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/30 bg-secondary transition-colors hover:border-primary/50">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setEditPhotoUrl(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }} />
                      {editPhotoUrl ? (
                        <img src={editPhotoUrl} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                          <Camera className="h-6 w-6" />
                          <span>Adicionar</span>
                        </div>
                      )}
                    </label>
                    {editPhotoUrl && (
                      <button type="button" onClick={() => setEditPhotoUrl(null)} className="mt-1 text-xs text-destructive hover:underline">
                        Remover foto
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-cg-name">Nome completo</Label>
                    <Input id="edit-cg-name" name="full_name" required maxLength={100} defaultValue={editingCg.full_name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-cg-email">E-mail</Label>
                    <Input id="edit-cg-email" name="email" type="email" required maxLength={255} defaultValue={editingCg.email} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-cg-password">Nova senha (deixe vazio para manter)</Label>
                    <Input id="edit-cg-password" name="password" type="text" minLength={6} maxLength={72} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-cg-phone">Telefone (opcional)</Label>
                    <Input id="edit-cg-phone" name="phone" maxLength={30} defaultValue={editingCg.phone || ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Localização de trabalho
                    </Label>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Endereço</Label>
                      <AddressSearch
                        value={editAddress}
                        onChange={setEditAddress}
                        onCoordinates={(lat, lng) => setEditCoords({ lat, lng })}
                        placeholder="Rua, bairro, cidade"
                        number={editNumber}
                        onNumberChange={setEditNumber}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Raio permitido (metros)</Label>
                      <Input name="location_radius" type="number" min="10" max="5000" defaultValue={editingCg.location_radius || 100} />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-cg-supervisor"
                      checked={editIsSupervisor}
                      onCheckedChange={(checked) => setEditIsSupervisor(checked === true)}
                    />
                    <Label htmlFor="edit-cg-supervisor" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Acesso de supervisor
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={updateCaregiver.isPending}>
                    {updateCaregiver.isPending ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
          </>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cuidador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {caregivers?.filter((cg: any) =>
          !search ||
          (cg.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
          (cg.email || "").toLowerCase().includes(search.toLowerCase()),
        ).map((cg: any) => (
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
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => openEdit(cg)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
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
                </div>
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
      {caregivers && caregivers.length > 0 && caregivers.filter((cg: any) =>
        !search ||
        (cg.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (cg.email || "").toLowerCase().includes(search.toLowerCase()),
      ).length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum cuidador encontrado para "{search}".
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
