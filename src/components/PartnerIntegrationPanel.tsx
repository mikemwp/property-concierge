"use client";

import { useState } from "react";
import { syncPartnerStatusAction } from "@/app/actions/partner-integration";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";
import type {
  PartnerActivityRow,
  PartnerTicketSummary,
} from "@/domain/partner-activity";
import type { ActorRole } from "@/domain/types";

type Props = {
  caseId: string;
  tickets: PartnerTicketSummary[];
  activity: PartnerActivityRow[];
  railsEnabled: boolean;
  syncableRoles: ActorRole[];
  roleLabels: Partial<Record<ActorRole, string>>;
  milestoneLabels: Record<string, string>;
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

function formatTimestamp(at: string): string {
  return new Date(at).toLocaleString();
}

function roleLabel(
  roleLabels: Partial<Record<ActorRole, string>>,
  role: ActorRole,
): string {
  return roleLabels[role] ?? formatLabel(role);
}

function milestoneLabel(
  milestoneLabels: Record<string, string>,
  role: ActorRole,
  key: string,
): string {
  return milestoneLabels[`${role}:${key}`] ?? formatLabel(key);
}

function isUnacknowledged(ticket: PartnerTicketSummary): boolean {
  return ticket.acknowledgedAt === null && ticket.openDays >= 1;
}

export function PartnerIntegrationPanel({
  caseId,
  tickets,
  activity,
  railsEnabled,
  syncableRoles,
  roleLabels,
  milestoneLabels,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  async function runSync() {
    setError(null);
    const result = await syncPartnerStatusAction(caseId);
    if (!result.ok) {
      setError(result.error ?? "Sync failed");
    }
  }

  if (tickets.length === 0 && activity.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Partner integration</h2>
      <p className="mt-1 text-sm text-slate-600">
        Integration tickets and adapter activity across all partner roles on this case.
      </p>
      <ActionErrorBanner error={error} />

      {tickets.length > 0 && (
        <ul className="mt-4 space-y-3">
          {tickets.map((ticket) => {
            const open = ticket.closedAt === null;
            const canSync =
              railsEnabled &&
              open &&
              syncableRoles.includes(ticket.role);

            return (
              <li
                key={ticket.ticketId}
                className={`rounded-lg border px-4 py-3 ${
                  isUnacknowledged(ticket)
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">
                      {roleLabel(roleLabels, ticket.role)}
                      {ticket.panelMemberName ? ` — ${ticket.panelMemberName}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Adapter: <span className="font-mono">{ticket.adapterId}</span>
                      {" · "}
                      Ticket: <span className="font-mono">{ticket.ticketId}</span>
                    </p>
                  </div>
                  {ticket.closedAt ? (
                    <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                      Closed — {ticket.closeReason === "REROUTED" ? "re-routed" : "closed"}
                    </span>
                  ) : isUnacknowledged(ticket) ? (
                    <span className="rounded bg-amber-200 px-2 py-1 text-xs font-medium text-amber-900">
                      Unacknowledged ({ticket.openDays} day
                      {ticket.openDays === 1 ? "" : "s"})
                    </span>
                  ) : null}
                </div>

                <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Opened</dt>
                    <dd>{formatTimestamp(ticket.openedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Last update</dt>
                    <dd>{formatTimestamp(ticket.lastUpdateAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Acknowledgement</dt>
                    <dd>
                      {ticket.acknowledgedAt
                        ? `Acknowledged ${formatTimestamp(ticket.acknowledgedAt)}${
                            ticket.ackLatencyDays != null
                              ? ` (${ticket.ackLatencyDays} day${
                                  ticket.ackLatencyDays === 1 ? "" : "s"
                                })`
                              : ""
                          }`
                        : "Not yet acknowledged"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Last status</dt>
                    <dd>
                      {ticket.lastStatus
                        ? formatLabel(ticket.lastStatus)
                        : "None recorded"}
                    </dd>
                  </div>
                  {ticket.milestoneKeys.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">Milestones</dt>
                      <dd>
                        {ticket.milestoneKeys
                          .map((key) => milestoneLabel(milestoneLabels, ticket.role, key))
                          .join(", ")}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-slate-500">Evidence submitted</dt>
                    <dd>{ticket.evidenceSubmitted}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Nudges</dt>
                    <dd>{ticket.nudges}</dd>
                  </div>
                </dl>

                {canSync && (
                  <form
                    action={runSync}
                    className="mt-3"
                  >
                    <button
                      type="submit"
                      className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
                    >
                      Sync partner status
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {activity.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-900">Activity</h3>
          <ul className="mt-2 space-y-2">
            {activity.map((row, index) => (
              <li
                key={`${row.at}-${row.type}-${index}`}
                className="rounded border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <span className="font-medium">{formatLabel(row.type)}</span>
                <span className="text-slate-500">
                  {" "}
                  · {formatTimestamp(row.at)}
                </span>
                {row.role && (
                  <span className="text-slate-600">
                    {" "}
                    · {roleLabel(roleLabels, row.role)}
                  </span>
                )}
                {row.status && (
                  <span className="text-slate-600">
                    {" "}
                    · {formatLabel(row.status)}
                  </span>
                )}
                {row.milestoneKey && row.role && (
                  <span className="text-slate-600">
                    {" "}
                    · {milestoneLabel(milestoneLabels, row.role, row.milestoneKey)}
                  </span>
                )}
                {row.detail && (
                  <span className="text-slate-600"> · {row.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
