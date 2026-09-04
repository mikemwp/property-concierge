import { signOut } from "@/lib/auth";

type Props = {
  className?: string;
};

export function SignOutButton({ className }: Props) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className={
          className ??
          "rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
        }
      >
        Sign out
      </button>
    </form>
  );
}
