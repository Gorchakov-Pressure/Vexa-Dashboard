"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Video,
  Plus,
  Settings,
  X,
  Users,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useJoinModalStore } from "@/stores/join-modal-store";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Meetings", href: "/meetings", icon: Video },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Users", href: "/admin/users", icon: Users },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const openJoinModal = useJoinModalStore((state) => state.openModal);

  const handleJoinClick = () => {
    openJoinModal();
    onClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar - fixed on mobile, relative on desktop */}
      <aside
        className={cn(
          // Mobile: fixed, full height, slides in
          "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r",
          "transform transition-transform duration-200 ease-in-out",
          // Desktop: relative, part of flex layout
          "md:relative md:z-0 md:translate-x-0 md:flex md:flex-col md:shrink-0",
          // Mobile visibility
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Mobile header */}
          <div className="flex h-14 items-center justify-between border-b px-4 md:hidden shrink-0">
            <span className="font-semibold">Menu</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation - scrollable area */}
          <ScrollArea className="flex-1">
            <nav className="space-y-1 p-4">
              {navigation.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
              {/* Join Meeting button */}
              <button
                onClick={handleJoinClick}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="h-5 w-5" />
                Join Meeting
              </button>

              {/* Admin Section */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center gap-2 px-3 mb-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Admin
                  </span>
                </div>
                {adminNavigation.map((item) => {
                  const isActive = pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t p-4 shrink-0">
            <p className="text-xs text-muted-foreground">
              Vexa Dashboard v1.0
            </p>
            <p className="text-xs text-muted-foreground">
              Open Source Meeting Transcription
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
