import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/dashboard/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", user?.id],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data: telemetry, error } = await supabase
        .from("telematics_data")
        .select("speed, fuel_level, recorded_at")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true })
        .limit(500);
      if (error) throw error;

      const { data: trips } = await supabase
        .from("trips")
        .select("distance, avg_speed, start_time")
        .eq("status", "completed")
        .gte("start_time", since)
        .order("start_time", { ascending: true });

      // Aggregate by day
      const dailyMap = new Map<string, { speed: number[]; fuel: number[]; distance: number }>();
      (telemetry ?? []).forEach((t) => {
        const day = format(new Date(t.recorded_at), "MMM d");
        if (!dailyMap.has(day)) dailyMap.set(day, { speed: [], fuel: [], distance: 0 });
        const d = dailyMap.get(day)!;
        d.speed.push(t.speed);
        d.fuel.push(t.fuel_level);
      });
      (trips ?? []).forEach((t) => {
        const day = format(new Date(t.start_time), "MMM d");
        if (!dailyMap.has(day)) dailyMap.set(day, { speed: [], fuel: [], distance: 0 });
        dailyMap.get(day)!.distance += t.distance ?? 0;
      });

      const chartData = Array.from(dailyMap.entries()).map(([day, d]) => ({
        day,
        avgSpeed: d.speed.length ? Math.round(d.speed.reduce((a, b) => a + b, 0) / d.speed.length) : 0,
        avgFuel: d.fuel.length ? Math.round(d.fuel.reduce((a, b) => a + b, 0) / d.fuel.length) : 0,
        distance: Math.round(d.distance * 10) / 10,
      }));

      return chartData;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const chartData = data ?? [];
  const noData = chartData.length === 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      {noData ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No data yet. Start tracking vehicles to see analytics.</CardContent></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Average Speed (km/h)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="avgSpeed" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Distance per Day (km)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="distance" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm">Fuel Level Trend (%)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="avgFuel" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
