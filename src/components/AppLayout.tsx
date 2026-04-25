import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Activity, LogOut } from "lucide-react";
import { ReactNode } from "react";

export const AppLayout = ({ children, nav }: { children: ReactNode; nav?: ReactNode }) => {
  const { signOut, user, role } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-elegant">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold tracking-tight leading-none">Pulse</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">HR Analytics</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">{nav}</nav>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {user?.email} · <span className="text-primary font-medium">{role}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate("/auth");
              }}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
};

export const NavItem = ({ to, label }: { to: string; label: string }) => {
  const loc = useLocation();
  const active = loc.pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </Link>
  );
};