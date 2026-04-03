import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, MapPin, Bell, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const [vehicles, activeTrips, unackAlerts, totalTrips] = await Promise.all([
        supabase.from("vehicles").select("id", { count: "exact", head: true }),
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("alerts").select("id", { count: "exact", head: true }).eq("acknowledged", false),
        supabase.from("trips").select("distance").eq("status", "completed"),
      ]);
      const totalDistance = (totalTrips.data ?? []).reduce((sum, t) => sum + (t.distance ?? 0), 0);
      return {
        vehicleCount: vehicles.count ?? 0,
        activeTrips: activeTrips.count ?? 0,
        unackAlerts: unackAlerts.count ?? 0,
        totalDistance: Math.round(totalDistance),
      };
    },
    enabled: !!user,
  });

  const cards = [
    { label: "Vehicles", value: stats?.vehicleCount ?? 0, icon: Car, color: "text-primary" },
    { label: "Active Trips", value: stats?.activeTrips ?? 0, icon: RouteIcon, color: "text-success" },
    { label: "Unread Alerts", value: stats?.unackAlerts ?? 0, icon: Bell, color: "text-warning" },
    { label: "Total Distance", value: `${stats?.totalDistance ?? 0} km`, icon: MapPin, color: "text-chart-5" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
