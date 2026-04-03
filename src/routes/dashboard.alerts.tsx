import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, Thermometer, Fuel } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/alerts")({
  component: AlertsPage,
});

const alertIcons: Record<string, typeof AlertTriangle> = {
  overspeed: AlertTriangle,
  high_temp: Thermometer,
  low_fuel: Fuel,
};

const severityColors: Record<string, string> = {
  info: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

function AlertsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*, vehicles(model, manufacturer)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").update({ acknowledged: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert acknowledged");
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Alerts</h1>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : alerts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No alerts yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const Icon = alertIcons[a.type] ?? AlertTriangle;
            return (
              <Card key={a.id} className={a.acknowledged ? "opacity-60" : ""}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${severityColors[a.severity] ?? severityColors.info}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{a.message}</span>
                      <Badge variant="outline" className="text-xs capitalize">{a.type.replace("_", " ")}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.vehicles ? `${(a.vehicles as any).manufacturer} ${(a.vehicles as any).model}` : ""} · {format(new Date(a.created_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  {!a.acknowledged && (
                    <Button variant="ghost" size="sm" onClick={() => acknowledge.mutate(a.id)}>
                      <Check className="h-4 w-4 mr-1" />Ack
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
