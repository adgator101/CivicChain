import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck className="size-6 text-primary" />
        CivicChain <span className="text-sm font-normal text-muted-foreground">Nepal</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
