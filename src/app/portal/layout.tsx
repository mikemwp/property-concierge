import { auth } from "@/lib/auth";
import { roleCanAccess } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

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
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <strong className="text-slate-900">Client Portal</strong>
        <span className="ml-4 text-sm text-slate-600">
          {session.user.name ?? session.user.email} ({session.user.role})
        </span>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
