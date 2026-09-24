import type { DisclosureInput } from "./types";

function displayName(partnerName: string, partnerFirm: string | null): string {
  return partnerFirm ? `${partnerName} (${partnerFirm})` : partnerName;
}

export function usDisclosureText(input: DisclosureInput): string {
  const who = displayName(input.partnerName, input.partnerFirm);
  switch (input.role) {
    case "MORTGAGE_PARTNER":
      return `Property Concierge introduced you to ${who}. We act as an introducer only and do not give mortgage advice. We may receive an introducer fee from ${who} if you take a loan through them. You are free to use any mortgage broker.`;
    case "CONVEYANCER":
      return `Property Concierge referred you to ${who}. We may receive a referral fee from ${who} if you instruct them. You are free to instruct any closing attorney or escrow company.`;
    case "MOVE_PARTNER":
      return `Property Concierge referred you to ${who}. We may receive a commission from ${who} if you book with them. You are free to use any movers or relocation provider.`;
    default:
      throw new Error("Disclosure text applies to partner roles only");
  }
}
