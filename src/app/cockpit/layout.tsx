import { auth } from "@/lib/auth";
import { roleCanAccess } from "@/lib/auth-roles";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

export default async function CockpitLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!roleCanAccess(session.user.role, "cockpit")) {
    redirect("/login?error=Forbidden");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          borderBottom: "1px solid #ddd",
          padding: "1rem",
          background: "#0f172a",
          color: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <strong>Advisor Cockpit</strong>
          <span style={{ marginLeft: "1rem", opacity: 0.85 }}>
            {session.user.name ?? session.user.email}
          </span>
        </div>
        <SignOutButton className="rounded border border-slate-400 px-3 py-1 text-sm text-slate-100 hover:bg-slate-800" />
      </header>
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
