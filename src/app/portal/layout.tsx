import { auth } from "@/lib/auth";
import { roleCanAccess } from "@/lib/auth-roles";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!roleCanAccess(session.user.role, "portal")) {
    redirect("/login?error=Forbidden");
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <strong className="text-slate-900">Client Portal</strong>
          <span className="ml-4 text-sm text-slate-600">
            {session.user.name ?? session.user.email} ({session.user.role})
          </span>
        </div>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
