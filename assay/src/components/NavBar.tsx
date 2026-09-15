import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { User } from "@prisma/client";
import { Wordmark } from "@/components/ui/Seal";
import { Button } from "@/components/ui/Button";
import { LogoutButton } from "@/components/LogoutButton";

export function NavBar({ user }: { user: User | null }) {
  return (
    <div className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-[62px] max-w-[1080px] items-center justify-between px-[22px]">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-5 text-sm font-medium text-ink-soft sm:flex">
            <Link href="/exchange" className="hover:text-ink">
              Exchange
            </Link>
            <Link href="/insights" className="hover:text-ink">
              Insights
            </Link>
            <Link href="/pricing" className="hover:text-ink">
              Pricing
            </Link>
            {user && (
              <Link href={user.role === "ADMIN" ? "/admin" : "/dashboard/buyer"} className="hover:text-ink">
                Dashboard
              </Link>
            )}
          </nav>
          {user ? (
            <div className="flex items-center gap-2">
              <Link href="/sell/new">
                <Button kind="ghost">List a company</Button>
              </Link>
              <LogoutButton />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/sign-in">
                <Button kind="ghost">Sign in</Button>
              </Link>
              <Link href="/exchange">
                <Button kind="primary" icon={ArrowRight}>
                  Browse the exchange
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
