import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Gauge, Thermometer, Fuel, MapPin, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/tracking")({
  component: TrackingPage,
});

function TrackingPage() {
  const { user } = useAuth();
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [simulating, setSimulating] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: latestTelemetry, refetch } = useQuery({
    queryKey: ["latest-telemetry", selectedVehicle],
    queryFn: async () => {
      if (!selectedVehicle) return null;
      const { data, error } = await supabase
        .from("telematics_data")
        .select("*")
        .eq("vehicle_id", selectedVehicle)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!selectedVehicle,
    refetchInterval: simulating ? 3000 : false,
  });

  const simulateData = useCallback(async () => {
    if (!selectedVehicle || !user) return;
    const speed = Math.round(40 + Math.random() * 100);
    const rpm = Math.round(800 + Math.random() * 5000);
    const engineTemp = Math.round(70 + Math.random() * 50);
    const fuelLevel = Math.round(5 + Math.random() * 90);
    const lat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const lng = -74.006 + (Math.random() - 0.5) * 0.1;

    const { error } = await supabase.from("telematics_data").insert({
      vehicle_id: selectedVehicle,
      speed,
      rpm,
      engine_temp: engineTemp,
      fuel_level: fuelLevel,
      latitude: lat,
      longitude: lng,
    });
    if (error) {
      toast.error("Failed to simulate data");
      return;
    }

    // Auto-generate alerts
    const alerts: Array<{ vehicle_id: string; type: string; message: string; severity: string }> = [];
    if (speed > 120) alerts.push({ vehicle_id: selectedVehicle, type: "overspeed", message: `Speed ${speed} km/h exceeds 120 km/h limit`, severity: "critical" });
    if (engineTemp > 100) alerts.push({ vehicle_id: selectedVehicle, type: "high_temp", message: `Engine temp ${engineTemp}°C exceeds 100°C threshold`, severity: "critical" });
    if (fuelLevel < 10) alerts.push({ vehicle_id: selectedVehicle, type: "low_fuel", message: `Fuel level at ${fuelLevel}%`, severity: "warning" });

    if (alerts.length > 0) {
      await supabase.from("alerts").insert(alerts);
    }

    refetch();
  }, [selectedVehicle, user, refetch]);

  useEffect(() => {
    if (!simulating) return;
    const interval = setInterval(simulateData, 3000);
    return () => clearInterval(interval);
  }, [simulating, simulateData]);

  const gauges = latestTelemetry ? [
    { label: "Speed", value: `${latestTelemetry.speed} km/h`, icon: Gauge, alert: latestTelemetry.speed > 120 },
    { label: "RPM", value: `${latestTelemetry.rpm}`, icon: RefreshCw, alert: false },
    { label: "Engine Temp", value: `${latestTelemetry.engine_temp}°C`, icon: Thermometer, alert: latestTelemetry.engine_temp > 100 },
    { label: "Fuel Level", value: `${latestTelemetry.fuel_level}%`, icon: Fuel, alert: latestTelemetry.fuel_level < 10 },
  ] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Live Tracking</h1>
        <div className="flex items-center gap-3">
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
            <>
              <Button variant={simulating ? "destructive" : "default"} onClick={() => { setSimulating(!simulating); if (!simulating) simulateData(); }}>
                {simulating ? "Stop Simulation" : "Start Simulation"}
              </Button>
            </>
          )}
        </div>
      </div>

      {!selectedVehicle ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a vehicle to view live telemetry data.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {gauges.map((g) => (
              <Card key={g.label} className={g.alert ? "border-destructive/50" : ""}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${g.alert ? "bg-destructive/10" : "bg-primary/10"}`}>
                    <g.icon className={`h-5 w-5 ${g.alert ? "text-destructive" : "text-primary"}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{g.label}</p>
                    <p className="text-xl font-bold">{g.value}</p>
                  </div>
                  {g.alert && <Badge variant="destructive" className="ml-auto text-xs">ALERT</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>

          {latestTelemetry?.latitude && latestTelemetry?.longitude && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" />GPS Location</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted/50 border border-border p-8 text-center">
                  <MapPin className="h-12 w-12 mx-auto text-primary mb-3" />
                  <p className="text-lg font-mono font-semibold">
                    {latestTelemetry.latitude.toFixed(6)}, {latestTelemetry.longitude.toFixed(6)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Last updated: {new Date(latestTelemetry.recorded_at).toLocaleTimeString()}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {simulating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Simulating live data every 3 seconds...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
