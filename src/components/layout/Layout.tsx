import { ReactNode, useRef, useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Home, Dumbbell, Activity, User, Utensils, Globe, ArrowUp } from "lucide-react";
import { ToastContainer } from "@/components/ui/Toast";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/utils/cn";

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  return (
    <Link
      to={to}
      onClick={triggerHaptic}
      className="group relative flex flex-1 flex-col items-center p-3 text-text-muted hover:text-text-primary [&.active]:text-primary transition-colors"
    >
      <div className="absolute top-0 w-8 h-0.5 bg-primary scale-x-0 group-[.active]:scale-x-100 transition-transform origin-center rounded-b-full shadow-[0_0_8px_rgba(204,255,0,0.8)]" />
      <Icon size={22} strokeWidth={2.5} className="mt-1" />
      <span className="text-[10px] mt-1 font-medium tracking-wide">
        {label}
      </span>
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > 300);
  };

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex justify-center bg-bg-surface min-h-screen">
      <div className="flex flex-col h-[100dvh] w-full max-w-md bg-bg text-text-primary relative shadow-2xl border-x border-border overflow-hidden">
        <ToastContainer />
        <main
          ref={mainRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto pb-[calc(80px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] scroll-smooth no-scrollbar"
        >
          <div className="px-4">{children}</div>
        </main>

        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              onClick={scrollToTop}
              className="absolute bottom-24 right-4 z-40 p-3 rounded-full bg-primary text-primary-text shadow-[0_0_16px_rgba(204,255,0,0.3)] hover:scale-105 active:scale-95 transition-transform"
            >
              <ArrowUp className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>

        <nav className="absolute bottom-0 w-full bg-bg-surface/90 backdrop-blur-md border-t border-border flex justify-between items-center z-50 pb-[env(safe-area-inset-bottom)]">
          <NavItem to="/" icon={Home} label="Home" />
          <NavItem to="/exercises" icon={Dumbbell} label="Exercises" />
          <NavItem to="/feed" icon={Globe} label="Feed" />
          <NavItem to="/nutrition" icon={Utensils} label="Nutrition" />
          <NavItem to="/stats" icon={Activity} label="Stats" />
          <NavItem to="/profile" icon={User} label="Profile" />
        </nav>
      </div>
    </div>
  );
}
