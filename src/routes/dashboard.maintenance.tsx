import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Droplets, Cog, Disc, CircleDot, Zap, Wind, Shield, Wrench,
  Brain, RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/maintenance")({
  component: MaintenancePage,
});

const CATEGORIES = [
  { value: "fluids", label: "Fluids", icon: Droplets, desc: "Oil, coolant, brake fluid, transmission fluid" },
  { value: "engine", label: "Engine", icon: Cog, desc: "Pistons, valves, timing, spark plugs" },
  { value: "transmission", label: "Transmission", icon: Cog, desc: "Gears, clutch, torque converter" },
  { value: "brakes", label: "Brakes", icon: Disc, desc: "Pads, rotors, calipers, ABS" },
  { value: "tires", label: "Tires", icon: CircleDot, desc: "Tread, pressure, alignment, rotation" },
  { value: "electrical", label: "Electrical", icon: Zap, desc: "Battery, alternator, wiring, sensors" },
  { value: "cooling", label: "Cooling", icon: Wind, desc: "Radiator, thermostat, water pump, hoses" },
  { value: "body", label: "Body", icon: Shield, desc: "Frame, paint, glass, wipers, doors" },
  { value: "suspension", label: "Suspension", icon: Wrench, desc: "Shocks, struts, springs, bushings" },
];

const CONDITION_MAP: Record<string, { color: string; label: string; progress: number }> = {
  good: { color: "bg-green-500", label: "Good", progress: 90 },
  fair: { color: "bg-yellow-500", label: "Fair", progress: 65 },
  warning: { color: "bg-orange-500", label: "Warning", progress: 35 },
  critical: { color: "bg-red-500", label: "Critical", progress: 10 },
};

function MaintenancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: maintenanceRecords = [], isLoading: loadingRecords } = useQuery({
    queryKey: ["maintenance-records", selectedVehicle],
    queryFn: async () => {
      if (!selectedVehicle) return [];
      const { data, error } = await supabase
        .from("maintenance_records")
        .select("*")
        .eq("vehicle_id", selectedVehicle)
        .order("category", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVehicle,
  });

  const { data: telematicsData = [] } = useQuery({
    queryKey: ["recent-telematics", selectedVehicle],
    queryFn: async () => {
      if (!selectedVehicle) return [];
      const { data, error } = await supabase
        .from("telematics_data")
        .select("*")
        .eq("vehicle_id", selectedVehicle)
        .order("recorded_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVehicle,
  });

  const predictMutation = useMutation({
    mutationFn: async () => {
      const vehicle = vehicles.find((v) => v.id === selectedVehicle);
      if (!vehicle) throw new Error("Vehicle not found");

      const { data, error } = await supabase.functions.invoke("predict-maintenance", {
        body: {
          vehicleInfo: vehicle,
          telematicsData,
          currentMaintenance: maintenanceRecords,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.predictions as Array<{
        category: string; part_name: string; condition: string;
        predicted_failure_date?: string; next_service_due?: string;
        ai_recommendation: string;
      }>;
    },
    onSuccess: async (predictions) => {
      // Delete existing records for this vehicle and insert new ones
      await supabase.from("maintenance_records").delete().eq("vehicle_id", selectedVehicle);

      const records = predictions.map((p) => ({
        vehicle_id: selectedVehicle,
        category: p.category,
        part_name: p.part_name,
        condition: p.condition,
        predicted_failure_date: p.predicted_failure_date || null,
        next_service_due: p.next_service_due || null,
        ai_recommendation: p.ai_recommendation,
      }));

      if (records.length > 0) {
        await supabase.from("maintenance_records").insert(records);
      }

      queryClient.invalidateQueries({ queryKey: ["maintenance-records", selectedVehicle] });
      toast.success(`AI analyzed ${predictions.length} components`);
    },
    onError: (err: any) => {
      toast.error(err.message || "AI prediction failed");
    },
  });

  const selectedVehicleInfo = vehicles.find((v) => v.id === selectedVehicle);

  const groupedRecords = CATEGORIES.map((cat) => ({
    ...cat,
    records: maintenanceRecords.filter((r: any) => r.category === cat.value),
  }));

  const overallHealth = maintenanceRecords.length > 0
    ? Math.round(maintenanceRecords.reduce((acc: number, r: any) => acc + (CONDITION_MAP[r.condition]?.progress || 50), 0) / maintenanceRecords.length)
    : 0;

  const criticalCount = maintenanceRecords.filter((r: any) => r.condition === "critical").length;
  const warningCount = maintenanceRecords.filter((r: any) => r.condition === "warning").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Predictive Maintenance</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-powered vehicle health analysis</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select vehicle" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.manufacturer} {v.model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedVehicle && (
            <Button onClick={() => predictMutation.mutate()} disabled={predictMutation.isPending}>
              <Brain className="h-4 w-4 mr-1" />
              {predictMutation.isPending ? "Analyzing..." : "Run AI Analysis"}
            </Button>
          )}
        </div>
      </div>

      {!selectedVehicle ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a vehicle to view maintenance analysis.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {/* Health Overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Overall Health</p>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">{overallHealth || "—"}%</p>
                <Progress value={overallHealth} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Critical Issues</p>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Warnings</p>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold text-yellow-500">{warningCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Parts Tracked</p>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{maintenanceRecords.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Vehicle Info */}
          {selectedVehicleInfo && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Wrench className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedVehicleInfo.manufacturer} {selectedVehicleInfo.model}</p>
                    <p className="text-sm text-muted-foreground">{selectedVehicleInfo.year} • {selectedVehicleInfo.fuel_type}</p>
                  </div>
                  {telematicsData.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{telematicsData.length} telemetry readings</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat.value} value={cat.value} className="gap-1">
                  <cat.icon className="h-3 w-3" />
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              {maintenanceRecords.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No maintenance data yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">Click "Run AI Analysis" to generate predictions based on telematics data.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groupedRecords.filter((g) => g.records.length > 0).map((group) => {
                    const worstCondition = group.records.reduce((worst: string, r: any) => {
                      const order = ["good", "fair", "warning", "critical"];
                      return order.indexOf(r.condition) > order.indexOf(worst) ? r.condition : worst;
                    }, "good");

                    return (
                      <Card key={group.value} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setActiveTab(group.value)}>
                        <CardContent className="py-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                              <group.icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{group.label}</p>
                              <p className="text-xs text-muted-foreground">{group.records.length} parts</p>
                            </div>
                            <div className={`h-3 w-3 rounded-full ${CONDITION_MAP[worstCondition]?.color}`} />
                          </div>
                          <div className="space-y-1">
                            {group.records.slice(0, 3).map((r: any) => (
                              <div key={r.id} className="flex items-center justify-between text-xs">
                                <span className="truncate flex-1">{r.part_name}</span>
                                <Badge variant="outline" className="text-[10px] ml-2">{r.condition}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {CATEGORIES.map((cat) => (
              <TabsContent key={cat.value} value={cat.value}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <cat.icon className="h-5 w-5" /> {cat.label}
                    </CardTitle>
                    <CardDescription>{cat.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {groupedRecords.find((g) => g.value === cat.value)?.records.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No data for this category. Run AI Analysis to populate.</p>
                    ) : (
                      <div className="space-y-4">
                        {groupedRecords.find((g) => g.value === cat.value)?.records.map((r: any) => {
                          const cond = CONDITION_MAP[r.condition] || CONDITION_MAP.good;
                          return (
                            <div key={r.id} className="rounded-lg border p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{r.part_name}</p>
                                <div className="flex items-center gap-2">
                                  <div className={`h-2.5 w-2.5 rounded-full ${cond.color}`} />
                                  <Badge variant={r.condition === "critical" ? "destructive" : r.condition === "warning" ? "secondary" : "outline"}>
                                    {cond.label}
                                  </Badge>
                                </div>
                              </div>
                              <Progress value={cond.progress} className="h-1.5" />
                              <div className="grid gap-2 text-xs sm:grid-cols-3">
                                {r.predicted_failure_date && (
                                  <div>
                                    <span className="text-muted-foreground">Predicted Failure:</span>
                                    <p className="font-medium">{new Date(r.predicted_failure_date).toLocaleDateString()}</p>
                                  </div>
                                )}
                                {r.last_serviced && (
                                  <div>
                                    <span className="text-muted-foreground">Last Serviced:</span>
                                    <p className="font-medium">{new Date(r.last_serviced).toLocaleDateString()}</p>
                                  </div>
                                )}
                                {r.next_service_due && (
                                  <div>
                                    <span className="text-muted-foreground">Next Service:</span>
                                    <p className="font-medium">{new Date(r.next_service_due).toLocaleDateString()}</p>
                                  </div>
                                )}
                              </div>
                              {r.ai_recommendation && (
                                <div className="rounded-md bg-muted/50 p-3">
                                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1">
                                    <Brain className="h-3 w-3" /> AI Recommendation
                                  </div>
                                  <p className="text-sm">{r.ai_recommendation}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
}
