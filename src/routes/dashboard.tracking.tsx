import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Gauge, Thermometer, Fuel, MapPin, RefreshCw, AlertTriangle, Phone, Truck } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/dashboard/tracking")({
  component: TrackingPage,
});

const BREAKDOWN_TYPES = [
  { value: "engine", label: "Engine Failure", causes: ["Overheating", "Oil starvation", "Timing belt failure", "Fuel pump failure"], precautions: ["Pull over immediately", "Turn off engine", "Do not restart", "Move to safe area"] },
  { value: "transmission", label: "Transmission Failure", causes: ["Low transmission fluid", "Worn clutch plates", "Faulty solenoids", "Overheating"], precautions: ["Shift to neutral", "Apply parking brake", "Avoid forcing gears", "Wait for cooldown"] },
  { value: "electrical", label: "Electrical Failure", causes: ["Dead battery", "Alternator failure", "Blown fuses", "Wiring short circuit"], precautions: ["Turn off all electronics", "Activate hazard lights", "Check battery connections", "Do not jump-start without proper gear"] },
  { value: "tire", label: "Tire Blowout", causes: ["Under-inflation", "Road debris", "Worn tread", "Overloading"], precautions: ["Grip steering firmly", "Gradually decelerate", "Pull off road safely", "Use spare tire or call roadside assistance"] },
  { value: "brake", label: "Brake Failure", causes: ["Worn brake pads", "Brake fluid leak", "ABS malfunction", "Overheated rotors"], precautions: ["Downshift to slow down", "Use emergency brake gradually", "Find an uphill area", "Turn on hazard lights"] },
  { value: "cooling", label: "Cooling System Failure", causes: ["Coolant leak", "Radiator blockage", "Water pump failure", "Thermostat stuck"], precautions: ["Pull over immediately", "Do NOT open radiator cap when hot", "Let engine cool 30+ minutes", "Check coolant level when cool"] },
  { value: "fuel", label: "Fuel System Issue", causes: ["Empty tank", "Fuel line leak", "Contaminated fuel", "Fuel filter clog"], precautions: ["Pull over safely", "Check for fuel smell/leak", "Do not smoke near vehicle", "Call for fuel delivery if empty"] },
];

function TrackingPage() {
  const { user } = useAuth();
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [simulating, setSimulating] = useState(false);
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<typeof BREAKDOWN_TYPES[0] | null>(null);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [activeBreakdown, setActiveBreakdown] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

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

  const { data: breakdowns = [], refetch: refetchBreakdowns } = useQuery({
    queryKey: ["breakdowns", selectedVehicle],
    queryFn: async () => {
      if (!selectedVehicle) return [];
      const { data, error } = await supabase
        .from("breakdowns")
        .select("*")
        .eq("vehicle_id", selectedVehicle)
        .neq("status", "resolved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVehicle,
  });

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current).setView([40.7128, -74.006], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      }).addTo(map);

      mapRef.current = map;
    });

    return () => { cancelled = true; };
  }, []);

  // Update marker on telemetry change
  useEffect(() => {
    if (!mapRef.current || !latestTelemetry?.latitude || !latestTelemetry?.longitude) return;

    import("leaflet").then((L) => {
      const latlng: [number, number] = [latestTelemetry.latitude!, latestTelemetry.longitude!];

      if (markerRef.current) {
        markerRef.current.setLatLng(latlng);
      } else {
        markerRef.current = L.marker(latlng).addTo(mapRef.current);
      }

      const vehicle = vehicles.find(v => v.id === selectedVehicle);
      markerRef.current.bindPopup(
        `<b>${vehicle?.manufacturer || ""} ${vehicle?.model || ""}</b><br/>Speed: ${latestTelemetry.speed} km/h<br/>Temp: ${latestTelemetry.engine_temp}°C`
      );

      mapRef.current.setView(latlng, 14);
    });
  }, [latestTelemetry, selectedVehicle, vehicles]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const simulateData = useCallback(async () => {
    if (!selectedVehicle || !user) return;
    const speed = Math.round(40 + Math.random() * 100);
    const rpm = Math.round(800 + Math.random() * 5000);
    const engineTemp = Math.round(70 + Math.random() * 50);
    const fuelLevel = Math.round(5 + Math.random() * 90);
    const lat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const lng = -74.006 + (Math.random() - 0.5) * 0.1;

    const { error } = await supabase.from("telematics_data").insert({
      vehicle_id: selectedVehicle, speed, rpm, engine_temp: engineTemp,
      fuel_level: fuelLevel, latitude: lat, longitude: lng,
    });
    if (error) { toast.error("Failed to simulate data"); return; }

    const alerts: Array<{ vehicle_id: string; type: string; message: string; severity: string }> = [];
    if (speed > 120) alerts.push({ vehicle_id: selectedVehicle, type: "overspeed", message: `Speed ${speed} km/h exceeds 120 km/h limit`, severity: "critical" });
    if (engineTemp > 100) alerts.push({ vehicle_id: selectedVehicle, type: "high_temp", message: `Engine temp ${engineTemp}°C exceeds 100°C threshold`, severity: "critical" });
    if (fuelLevel < 10) alerts.push({ vehicle_id: selectedVehicle, type: "low_fuel", message: `Fuel level at ${fuelLevel}%`, severity: "warning" });

    if (alerts.length > 0) await supabase.from("alerts").insert(alerts);
    refetch();
  }, [selectedVehicle, user, refetch]);

  useEffect(() => {
    if (!simulating) return;
    const interval = setInterval(simulateData, 3000);
    return () => clearInterval(interval);
  }, [simulating, simulateData]);

  const reportBreakdown = async () => {
    if (!selectedBreakdown || !selectedVehicle) return;
    const { data, error } = await supabase.from("breakdowns").insert({
      vehicle_id: selectedVehicle,
      type: selectedBreakdown.value,
      description: selectedBreakdown.label,
      causes: selectedBreakdown.causes,
      precautions: selectedBreakdown.precautions,
      status: "detected",
      latitude: latestTelemetry?.latitude || null,
      longitude: latestTelemetry?.longitude || null,
    }).select().single();

    if (error) { toast.error("Failed to report breakdown"); return; }
    toast.warning("Breakdown reported!");
    setActiveBreakdown(data);
    setBreakdownDialogOpen(false);
    refetchBreakdowns();
  };

  const dispatchHelp = async () => {
    if (!activeBreakdown) return;
    const { error } = await supabase.from("breakdowns").update({
      status: "dispatched",
      dispatched_to: "Nearby Emergency Services",
      contact_info: dispatchNotes || "Emergency dispatch initiated",
    }).eq("id", activeBreakdown.id);

    if (error) { toast.error("Dispatch failed"); return; }
    toast.success("Help dispatched! Authorities have been contacted.");
    setDispatchDialogOpen(false);
    setDispatchNotes("");
    refetchBreakdowns();
  };

  const resolveBreakdown = async (id: string) => {
    await supabase.from("breakdowns").update({ status: "resolved" }).eq("id", id);
    toast.success("Breakdown resolved");
    setActiveBreakdown(null);
    refetchBreakdowns();
  };

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
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedVehicle} onValueChange={(v) => { setSelectedVehicle(v); markerRef.current = null; }}>
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
              <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setBreakdownDialogOpen(true)}>
                <AlertTriangle className="h-4 w-4 mr-1" /> Report Breakdown
              </Button>
            </>
          )}
        </div>
      </div>

      {!selectedVehicle ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a vehicle to view live telemetry data.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {/* Gauges */}
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

          {/* Map */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" />GPS Location</CardTitle></CardHeader>
            <CardContent>
              <div ref={mapContainerRef} className="h-[400px] rounded-lg overflow-hidden" style={{ zIndex: 0 }} />
              {latestTelemetry?.latitude && (
                <p className="text-xs text-muted-foreground mt-2">
                  {latestTelemetry.latitude.toFixed(6)}, {latestTelemetry.longitude?.toFixed(6)} — Last updated: {new Date(latestTelemetry.recorded_at).toLocaleTimeString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Active Breakdowns */}
          {breakdowns.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Active Breakdowns ({breakdowns.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {breakdowns.map((bd: any) => (
                  <div key={bd.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">{bd.type}</Badge>
                        <Badge variant={bd.status === "dispatched" ? "secondary" : "outline"}>{bd.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(bd.created_at).toLocaleString()}</span>
                    </div>

                    {bd.causes?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Possible Causes:</p>
                        <div className="flex flex-wrap gap-1">
                          {bd.causes.map((c: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{c}</Badge>)}
                        </div>
                      </div>
                    )}

                    {bd.precautions?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Precautions:</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                          {bd.precautions.map((p: string, i: number) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {bd.status === "detected" && (
                        <Button size="sm" variant="destructive" onClick={() => { setActiveBreakdown(bd); setDispatchDialogOpen(true); }}>
                          <Truck className="h-3 w-3 mr-1" /> Dispatch Help
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => window.open("tel:911")}>
                        <Phone className="h-3 w-3 mr-1" /> Call Authorities
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resolveBreakdown(bd.id)}>
                        Mark Resolved
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {simulating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Simulating live data every 3 seconds...
            </div>
          )}
        </div>
      )}

      {/* Report Breakdown Dialog */}
      <Dialog open={breakdownDialogOpen} onOpenChange={setBreakdownDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Report Vehicle Breakdown</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {BREAKDOWN_TYPES.map((bt) => (
              <button
                key={bt.value}
                onClick={() => setSelectedBreakdown(bt)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedBreakdown?.value === bt.value ? "border-destructive bg-destructive/10" : "border-border hover:bg-muted/50"}`}
              >
                <p className="font-medium text-sm">{bt.label}</p>
                <p className="text-xs text-muted-foreground mt-1">Causes: {bt.causes.join(", ")}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBreakdownDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!selectedBreakdown} onClick={reportBreakdown}>Report Breakdown</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch Dialog */}
      <Dialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dispatch Emergency Help</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Send a dispatch request to nearby emergency services and roadside assistance.</p>
            {activeBreakdown?.latitude && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium">Location</p>
                <p className="text-sm font-mono">{activeBreakdown.latitude.toFixed(6)}, {activeBreakdown.longitude?.toFixed(6)}</p>
              </div>
            )}
            <Textarea placeholder="Additional notes (vehicle condition, passengers, etc.)" value={dispatchNotes} onChange={(e) => setDispatchNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDispatchDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={dispatchHelp}><Truck className="h-4 w-4 mr-1" /> Dispatch Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
