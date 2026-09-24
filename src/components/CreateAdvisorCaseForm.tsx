"use client";

import { useState } from "react";
import { createAdvisorCaseAction } from "@/app/actions/case-admin";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import { listMarketPacks } from "@/domain/market-packs/registry";
import { ENTRY_CONTEXTS } from "@/domain/types";

const ENABLED_PACKS = listMarketPacks().filter((pack) => pack.enabled); // uk_au, uk_us

export function CreateAdvisorCaseForm() {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-8 space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      action={async (formData) => {
        setError(null);
        const result = await createAdvisorCaseAction({
          clientEmail: String(formData.get("clientEmail") ?? ""),
          title: String(formData.get("title") ?? ""),
          entryContext: String(formData.get("entryContext") ?? ""),
          marketPackId: String(formData.get("marketPackId") ?? ""),
          tier: String(formData.get("tier") ?? "PAID_DWY"),
        });
        if (!result.ok) {
          setError(result.error);
        }
      }}
    >
      <h2 className="text-lg font-medium text-slate-900">Open a corridor case</h2>
      <p className="text-sm text-slate-600">
        Use this for UK → Australia and UK → United States. Do not reassign an
        existing case — stage keys differ across spines.
      </p>
      <ActionErrorBanner error={error} />
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Client email</span>
        <input
          name="clientEmail"
          type="email"
          required
          defaultValue="client@example.com"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Case title</span>
        <input
          name="title"
          required
          placeholder="Patel UK→AU purchase (paid)"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Market pack</span>
        <select
          name="marketPackId"
          defaultValue="uk_au"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {ENABLED_PACKS.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.id} · {pack.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Entry context</span>
        <select
          name="entryContext"
          defaultValue="RETURNER_OVERSEAS"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {ENTRY_CONTEXTS.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="tier" value="PAID_DWY" />
      <button
        type="submit"
        className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
      >
        Create case
      </button>
    </form>
  );
}
