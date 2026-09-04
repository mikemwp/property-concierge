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
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          borderBottom: "1px solid #ddd",
          padding: "1rem",
          background: "#f8fafc",
        }}
      >
        <strong>Client Portal</strong>
        <span style={{ marginLeft: "1rem", color: "#475569" }}>
          {session.user.name ?? session.user.email} ({session.user.role})
        </span>
      </header>
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
