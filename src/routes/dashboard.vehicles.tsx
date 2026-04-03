import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/dashboard/vehicles")({
  component: VehiclesPage,
});

type Vehicle = Tables<"vehicles">;

function VehiclesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const upsert = useMutation({
    mutationFn: async (v: { model: string; manufacturer: string; year: number; fuel_type: string; id?: string }) => {
      if (v.id) {
        const { error } = await supabase.from("vehicles").update({ model: v.model, manufacturer: v.manufacturer, year: v.year, fuel_type: v.fuel_type }).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert({ model: v.model, manufacturer: v.manufacturer, year: v.year, fuel_type: v.fuel_type, owner: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Vehicle updated" : "Vehicle added");
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle deleted");
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Vehicles</h1>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Vehicle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
            </DialogHeader>
            <VehicleForm
              initial={editing}
              onSubmit={(v) => upsert.mutate(v)}
              loading={upsert.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No vehicles yet. Add your first vehicle to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Fuel</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.model}</TableCell>
                    <TableCell>{v.manufacturer}</TableCell>
                    <TableCell>{v.year}</TableCell>
                    <TableCell className="capitalize">{v.fuel_type}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(v); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove.mutate(v.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VehicleForm({ initial, onSubmit, loading }: { initial: Vehicle | null; onSubmit: (v: { model: string; manufacturer: string; year: number; fuel_type: string; id?: string }) => void; loading: boolean }) {
  const [model, setModel] = useState(initial?.model ?? "");
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [year, setYear] = useState(initial?.year?.toString() ?? new Date().getFullYear().toString());
  const [fuelType, setFuelType] = useState(initial?.fuel_type ?? "gasoline");

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ model, manufacturer, year: parseInt(year), fuel_type: fuelType, id: initial?.id }); }} className="space-y-4">
      <div className="space-y-2">
        <Label>Manufacturer</Label>
        <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} required placeholder="Toyota" />
      </div>
      <div className="space-y-2">
        <Label>Model</Label>
        <Input value={model} onChange={(e) => setModel(e.target.value)} required placeholder="Camry" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} required min={1990} max={2030} />
        </div>
        <div className="space-y-2">
          <Label>Fuel Type</Label>
          <Select value={fuelType} onValueChange={setFuelType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gasoline">Gasoline</SelectItem>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="electric">Electric</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : initial ? "Update Vehicle" : "Add Vehicle"}
      </Button>
    </form>
  );
}
