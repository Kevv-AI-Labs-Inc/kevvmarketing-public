import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useT } from "@/i18n";
import {
  dashboardMenuSections,
  getLocalizedText,
  ownerDashboardSection,
} from "@/lib/marketing-capabilities";
import { LocaleToggleButton } from "./LocaleToggleButton";
import {
  LogOut,
  PanelLeft,
  Settings,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { siteConfig } from "@/lib/site";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useT();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50/50 via-background to-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="font-serif text-3xl tracking-tight text-primary">{siteConfig.shortName}</span>
              <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">{t("shell.marketingWord")}</span>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t("shell.unauthenticatedPrompt")}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            {t("shell.signInCta")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { state, toggleSidebar } = useSidebar();
  const { t, locale } = useT();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const currentPath = pathname.split("?")[0];
  const isPathActive = (path: string) =>
    currentPath === path || (path !== "/" && currentPath.startsWith(`${path}/`));

  // TODO: Owner status check — use session role instead once admin role is fully wired
  const isOwner = user?.role === "admin";
  const menuSections = isOwner
    ? [...dashboardMenuSections, ownerDashboardSection]
    : dashboardMenuSections;

  // Find active label for mobile header
  const allItems = menuSections.flatMap((group) => group.items);
  const activeMenuItem = allItems.find(item => isPathActive(item.path));
  const isMobile = useIsMobile();

  const isResizingActive = isResizing && !isCollapsed;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingActive) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizingActive) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingActive, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          {/* Brand header */}
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-sidebar-accent rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label={t("shell.toggleNavigation")}
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed ? (
                <div className="flex flex-col min-w-0">
                  <span className="font-serif text-xl tracking-tight text-sidebar-foreground">
                    {siteConfig.shortName}
                  </span>
                  <span className="text-[10px] font-medium text-sidebar-foreground/50 tracking-widest uppercase -mt-0.5">
                    {t("shell.marketingWord")}
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-2">
            {menuSections.map((group, groupIdx) => (
              <div key={group.id}>
                {groupIdx > 0 && (
                  <div className="mx-2 my-1.5 border-t border-sidebar-border/60" />
                )}
                {!isCollapsed && (
                  <span className="block px-2 pt-1 pb-0.5 text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest select-none">
                    {getLocalizedText(locale, group.label)}
                  </span>
                )}
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = isPathActive(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => router.push(item.path)}
                          tooltip={getLocalizedText(locale, item.label)}
                          className={`h-8 rounded-lg transition-colors text-[13px] ${isActive
                            ? "bg-sidebar-accent font-medium"
                            : "hover:bg-sidebar-accent/50 font-normal"
                            }`}
                        >
                          <item.icon
                            className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground/50"}`}
                          />
                          <span className={isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70"}>
                            {getLocalizedText(locale, item.label)}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          <SidebarFooter className="px-2 pb-3 pt-1 space-y-0.5">
            <div className="mx-2 mb-1 border-t border-sidebar-border/60" />
            <SidebarMenu>
              <SidebarMenuItem>
                <LocaleToggleButton
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start rounded-lg px-2 text-[13px] font-normal text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => { }}
                  tooltip={t("sidebar.settings")}
                  className="h-8 rounded-lg text-[13px] font-normal text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span>{t("sidebar.settings")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1">
                  <Avatar className="h-7 w-7 border border-primary/20 shrink-0">
                    <AvatarFallback className="text-[11px] font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-[13px] font-medium truncate leading-none text-sidebar-foreground">
                      {user?.name || "-"}
                    </p>
                    <p className="text-[10px] text-sidebar-foreground/40 truncate mt-0.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("sidebar.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="tracking-tight text-foreground">
                    {activeMenuItem ? getLocalizedText(locale, activeMenuItem.label) : t("shell.menuFallback")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
