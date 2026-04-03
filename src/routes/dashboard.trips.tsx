import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard/trips")({
  component: TripsPage,
});

function TripsPage() {
  const { user } = useAuth();

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["trips", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, vehicles(model, manufacturer)")
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Trips</h1>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : trips.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No trips recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Avg Speed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.vehicles ? `${(t.vehicles as any).manufacturer} ${(t.vehicles as any).model}` : "Unknown"}
                    </TableCell>
                    <TableCell>{format(new Date(t.start_time), "MMM d, HH:mm")}</TableCell>
                    <TableCell>{t.end_time ? format(new Date(t.end_time), "MMM d, HH:mm") : "—"}</TableCell>
                    <TableCell>{t.distance ? `${t.distance.toFixed(1)} km` : "—"}</TableCell>
                    <TableCell>{t.avg_speed ? `${t.avg_speed.toFixed(1)} km/h` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === "active" ? "default" : "secondary"}>
                        {t.status}
                      </Badge>
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
