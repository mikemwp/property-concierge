import { auth } from "@/lib/auth";
import { roleCanAccess } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

export default async function PartnerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!roleCanAccess(session.user.role, "partner")) {
    redirect("/login?error=Forbidden");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          borderBottom: "1px solid #ddd",
          padding: "1rem",
          background: "#ecfdf5",
        }}
      >
        <strong>Partner View</strong>
        <span style={{ marginLeft: "1rem", color: "#065f46" }}>
          {session.user.name ?? session.user.email} ({session.user.role})
        </span>
      </header>
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
