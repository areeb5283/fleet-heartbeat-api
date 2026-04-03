import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Car, BarChart3, MapPin, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">VehicleIQ</span>
          </div>
          <div className="flex gap-3">
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            <Shield className="h-3.5 w-3.5" />
            OBD-II Telematics Platform
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
            Real-time Vehicle
            <br />
            <span className="text-primary">Intelligence</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Monitor your fleet in real-time. Track trips, analyze performance, and get instant alerts — all from a single dashboard.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link to={isAuthenticated ? "/dashboard" : "/register"}>
              <Button size="lg" className="px-8">
                {isAuthenticated ? "Go to Dashboard" : "Start Free"}
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { icon: MapPin, title: "Live Tracking", desc: "Real-time GPS tracking with simulated OBD-II telemetry data" },
              { icon: BarChart3, title: "Analytics", desc: "Speed trends, fuel consumption, and distance analytics over time" },
              { icon: Shield, title: "Smart Alerts", desc: "Instant alerts for overspeed, high temperature, and low fuel" },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
