"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mic, Plus, Settings, Menu, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useJoinModalStore } from "@/stores/join-modal-store";
import { useAuthStore } from "@/stores/auth-store";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const openJoinModal = useJoinModalStore((state) => state.openModal);
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="shrink-0 z-50 w-full border-b bg-background">
      <div className="flex h-14 items-center px-4 md:px-6">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary transition-transform group-hover:scale-105">
            <Mic className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="hidden sm:inline-block">Vexa Dashboard</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button size="sm" className="hidden sm:flex" onClick={openJoinModal}>
            <Plus className="mr-2 h-4 w-4" />
            Join Meeting
          </Button>

          <Button size="icon" variant="ghost" className="sm:hidden" onClick={openJoinModal}>
            <Plus className="h-5 w-5" />
          </Button>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user && (
                <>
                  <div className="px-2 py-1.5 text-sm">
                    <p className="font-medium">{user.name || user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
