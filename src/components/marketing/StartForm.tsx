"use client";

import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/app/actions/signup";
import type { RawAttributionParams } from "@/domain/attribution";
import type { EntryContext } from "@/domain/types";
import {
  DEFAULT_MARKET_PACK_ID,
  SELF_SERVE_MARKET_PACK_IDS,
  resolveMarketPack,
} from "@/domain/market-packs/registry";

type Props = {
  plan: "free" | "paid";
  entryContext: EntryContext;
  attribution: RawAttributionParams;
};

const ENTRY_OPTIONS: Array<{ value: EntryContext; label: string }> = [
  { value: "RETURNER_OVERSEAS", label: "Still overseas, planning the move" },
  { value: "RETURNER_IN_UK", label: "Back in the UK, temporary set-up" },
  { value: "UK_RESIDENT_SPEED", label: "Living here, want a faster purchase" },
];

const PACK_OPTIONS = SELF_SERVE_MARKET_PACK_IDS.map((id) => {
  const pack = resolveMarketPack(id);
  return { id: pack.id, name: pack.name, regionPrompt: pack.copy.region_prompt };
});

export function StartForm({ plan, entryContext, attribution }: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [marketPackId, setMarketPackId] = useState(DEFAULT_MARKET_PACK_ID);
  const selectedPack = useMemo(
    () => PACK_OPTIONS.find((pack) => pack.id === marketPackId) ?? PACK_OPTIONS[0]!,
    [marketPackId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setErrors({});
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const result = await signUpAction(formData);

    if (!result.ok) {
      setErrors(result.errors);
      setPending(false);
      return;
    }

    const signedIn = await signIn("credentials", {
      email: result.email,
      password,
      redirect: false,
    });

    if (signedIn?.error) {
      setErrors({ form: "Case created — please sign in to open it." });
      setPending(false);
      router.push("/login");
      return;
    }

    router.push(`/portal/cases/${result.caseId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-lg space-y-4">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="utm_source" value={attribution.utm_source ?? ""} />
      <input type="hidden" name="utm_medium" value={attribution.utm_medium ?? ""} />
      <input
        type="hidden"
        name="utm_campaign"
        value={attribution.utm_campaign ?? ""}
      />
      <input type="hidden" name="ref" value={attribution.ref ?? ""} />

      {errors.form && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errors.form}
        </p>
      )}

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Which corridor are you buying on?</span>
        <select
          name="marketPackId"
          value={marketPackId}
          onChange={(event) => setMarketPackId(event.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {PACK_OPTIONS.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.name}
            </option>
          ))}
        </select>
        {errors.marketPackId && (
          <span className="text-xs text-red-700">{errors.marketPackId}</span>
        )}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Household name</span>
        <input
          name="name"
          required
          defaultValue=""
          placeholder="Bloggs household"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.name && <span className="text-xs text-red-700">{errors.name}</span>}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.email && <span className="text-xs text-red-700">{errors.email}</span>}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.password && (
          <span className="text-xs text-red-700">{errors.password}</span>
        )}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          {selectedPack.regionPrompt}
        </span>
        <input
          name="targetRegion"
          required
          placeholder="Bristol"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.targetRegion && (
          <span className="text-xs text-red-700">{errors.targetRegion}</span>
        )}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Where are you starting from?
        </span>
        <select
          name="entryContext"
          defaultValue={entryContext}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {ENTRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.entryContext && (
          <span className="text-xs text-red-700">{errors.entryContext}</span>
        )}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending
          ? "Creating your case…"
          : plan === "paid"
            ? "Create my Done-With-You case"
            : "Create my free orientation case"}
      </button>
    </form>
  );
}
