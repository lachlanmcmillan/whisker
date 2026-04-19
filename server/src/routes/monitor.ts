import { json } from "../lib/http";
import { commitSha, startedAt } from "../runtime";

function formatISOWithTZ(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map(p => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${parts.timeZoneName?.replace("GMT", "") || "+00:00"}`;
}

export function handleMonitor(): Response {
  return json({
    commit: commitSha,
    serverTime: formatISOWithTZ(new Date(), "Australia/Melbourne"),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  });
}
