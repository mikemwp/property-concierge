import type { PartnerTicketSummary } from "@/domain/partner-activity";

type Props = {
  packName: string;
  roleLabel: string;
  stageTitle: string;
  slaDays: number;
  daysInStage: number;
  blockedReason?: string | null;
  ticket: PartnerTicketSummary | null;
};

function formatEventType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase();
}

export function PartnerCaseContext({
  packName,
  roleLabel,
  stageTitle,
  slaDays,
  daysInStage,
  blockedReason,
  ticket,
}: Props) {
  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
      <p className="text-sm font-medium uppercase tracking-wide text-emerald-800">
        Case context
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-emerald-700">Market pack</dt>
          <dd className="font-medium">{packName}</dd>
        </div>
        <div>
          <dt className="text-emerald-700">Your role</dt>
          <dd className="font-medium">{roleLabel}</dd>
        </div>
        <div>
          <dt className="text-emerald-700">Stage</dt>
          <dd className="font-medium">{stageTitle}</dd>
        </div>
        <div>
          <dt className="text-emerald-700">Pack SLA for this stage</dt>
          <dd className="font-medium">
            {slaDays} day{slaDays === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-700">Days in stage</dt>
          <dd className="font-medium">
            {daysInStage} day{daysInStage === 1 ? "" : "s"}
          </dd>
        </div>
        {blockedReason && (
          <div className="sm:col-span-2">
            <dt className="text-emerald-700">Blocked</dt>
            <dd className="font-medium">{blockedReason}</dd>
          </div>
        )}
        {ticket && (
          <>
            <div>
              <dt className="text-emerald-700">Ticket</dt>
              <dd className="font-medium font-mono text-xs">{ticket.ticketId}</dd>
            </div>
            <div>
              <dt className="text-emerald-700">Adapter</dt>
              <dd className="font-medium">{ticket.adapterId}</dd>
            </div>
            <div>
              <dt className="text-emerald-700">Acknowledgement</dt>
              <dd className="font-medium">
                {ticket.acknowledgedAt ? "Acknowledged" : "Not yet acknowledged"}
              </dd>
            </div>
            <div>
              <dt className="text-emerald-700">Last known status</dt>
              <dd className="font-medium">
                {ticket.lastStatus
                  ? formatEventType(ticket.lastStatus)
                  : "None recorded"}
              </dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
