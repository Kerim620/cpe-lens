import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "12rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEY = "cpe-lens.sidebar-collapsed";

interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside SidebarProvider");
  return context;
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => !readCollapsed());
  const [openMobile, setOpenMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1023px)").matches);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, open ? "0" : "1");
    } catch {
      // Cosmetic preference only.
    }
  }, [open]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((value) => !value);
    } else {
      setOpen((value) => !value);
    }
  }, [isMobile]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const value = useMemo(
    () => ({ open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }),
    [isMobile, open, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider delayDuration={0}>
      <div
        className="flex min-h-svh w-full"
        style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON } as CSSProperties}
      >
        {children}
      </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

function SidebarPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      {children}
    </div>
  );
}

export function Sidebar({ children, closeLabel = "Close", mobileTitle = "CPE Lens", mobileDescription = "Navigation" }: { children: ReactNode; closeLabel?: string; mobileTitle?: string; mobileDescription?: string }) {
  const { open, isMobile, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <Dialog onOpenChange={setOpenMobile} open={openMobile}>
        <DialogContent
          className="left-0 top-0 h-dvh max-h-none w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 p-0"
          closeLabel={closeLabel}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{mobileTitle}</DialogTitle>
            <DialogDescription>{mobileDescription}</DialogDescription>
          </DialogHeader>
          <SidebarPanel>{children}</SidebarPanel>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <aside
      className="sticky top-0 z-20 hidden h-svh shrink-0 overflow-hidden border-r border-border bg-sidebar lg:flex"
      data-state={open ? "expanded" : "collapsed"}
      style={{ width: open ? "var(--sidebar-width)" : "var(--sidebar-width-icon)" }}
    >
      <SidebarPanel>{children}</SidebarPanel>
    </aside>
  );
}

export function SidebarInset({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col bg-background">{children}</div>;
}

export function SidebarTrigger({ className, label }: { className?: string; label: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={toggleSidebar}
      title={label}
      type="button"
    >
      <PanelLeft className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function SidebarHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex h-14 shrink-0 items-center border-b border-border", className)}>{children}</div>;
}

export function SidebarContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto py-2", className)}>{children}</div>;
}

export function SidebarFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mt-auto border-t border-border p-2", className)}>{children}</div>;
}

export function SidebarCollapseButton({ collapseLabel, expandLabel }: { collapseLabel: string; expandLabel: string }) {
  const { open, isMobile, toggleSidebar } = useSidebar();
  const expanded = open || isMobile;
  const label = expanded ? collapseLabel : expandLabel;
  return (
    <button
      aria-label={label}
      className={cn(
        "flex h-8 w-full items-center rounded-sm text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        expanded ? "gap-2 px-2" : "justify-center px-0",
      )}
      onClick={toggleSidebar}
      title={label}
      type="button"
    >
      {expanded ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
      {expanded ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </button>
  );
}

export function SidebarGroup({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex w-full min-w-0 flex-col gap-1 px-2", className)}>{children}</div>;
}

export function SidebarGroupLabel({ className, children }: { className?: string; children: ReactNode }) {
  const { open, isMobile } = useSidebar();
  const expanded = open || isMobile;
  return (
    <div
      className={cn(
        "px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
        !expanded && "sr-only",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SidebarSeparator() {
  return <div aria-hidden="true" className="mx-2 my-1 h-px bg-border" />;
}

export function SidebarMenu({ className, children }: { className?: string; children: ReactNode }) {
  return <ul className={cn("flex w-full min-w-0 flex-col gap-0.5", className)}>{children}</ul>;
}

export function SidebarMenuItem({ className, children }: { className?: string; children: ReactNode }) {
  return <li className={cn("group/menu-item relative", className)}>{children}</li>;
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-sm text-left text-xs font-medium outline-none ring-sidebar-ring transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-active data-[active=true]:text-primary [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      collapsed: {
        true: "size-8 justify-center p-0 [&>svg]:size-4",
        false: "h-8 px-2.5",
      },
    },
    defaultVariants: { collapsed: false },
  },
);

export interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
}

export function SidebarMenuButton({
  className,
  asChild = false,
  isActive = false,
  collapsed = false,
  tooltip,
  children,
  ...props
}: SidebarMenuButtonProps & { collapsed?: boolean }) {
  const Comp = asChild ? Slot : "button";
  const button = (
    <Comp
      className={cn(sidebarMenuButtonVariants({ collapsed, className }))}
      data-active={isActive}
      title={tooltip}
      {...props}
    >
      {children}
    </Comp>
  );
  if (!tooltip || !collapsed) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
