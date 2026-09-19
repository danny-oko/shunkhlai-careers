"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useClerk } from "@clerk/nextjs";
import { LogOut, Moon, Sun, User } from "lucide-react";

import { displayName, useSession } from "@/components/auth/session-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pictureSrc } from "@/lib/api/profile";
import { cn } from "@/lib/utils";

/**
 * Account menu for a signed-in visitor.
 *
 * Gathers the three controls the header used to spread across the bar - theme
 * switch, anket link, sign out - behind one avatar, so the same menu works at
 * every breakpoint.
 *
 * The theme item follows `ThemeToggle`: both icons and both labels are in the
 * markup and swapped by the `dark` class variant, so the server and client
 * render the same tree. Toggling keeps the menu open (`preventDefault`) so the
 * change is visible where it was made.
 */
export function ProfileMenu({ className }: { className?: string }) {
  const { profile, signOut } = useSession();
  const { signOut: clerkSignOut } = useClerk();
  const { resolvedTheme, setTheme } = useTheme();

  // Clear the app session, then end the Clerk session so the bridge doesn't
  // immediately re-establish it.
  const handleSignOut = () => {
    signOut();
    void clerkSignOut({ redirectUrl: "/" });
  };

  const name = displayName(profile);
  const photo = profile ? pictureSrc(profile) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Хэрэглэгчийн цэс"
          className={cn(
            "rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            className,
          )}
        >
          <Avatar>
            {photo && <AvatarImage src={photo} alt="" />}
            <AvatarFallback>{name.slice(0, 1) || "?"}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">
          {name || "Миний анкет"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/account">
            <User />
            Миний анкет
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          }}
        >
          <Moon className="dark:hidden" />
          <Sun className="hidden dark:block" />
          <span className="dark:hidden">Харанхуй горим</span>
          <span className="hidden dark:inline">Гэрэл горим</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
          <LogOut />
          Гарах
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
