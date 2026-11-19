import type { HealthReport } from "./types";

const approximateAreaCoordinates: Array<{ match: RegExp; lat: number; lng: number }> = [
  { match: /pashan/i, lat: 18.5422, lng: 73.7925 },
  { match: /baner/i, lat: 18.5590, lng: 73.7868 },
  { match: /sus/i, lat: 18.5608, lng: 73.7536 },
  { match: /aundh/i, lat: 18.5610, lng: 73.8070 },
  { match: /bavdhan/i, lat: 18.5150, lng: 73.7780 },
];
export function reportCoordinates(report: HealthReport): { lat: number; lng: number; approximate: boolean } | null {
  if (typeof report.latitude === "number" && typeof report.longitude === "number") return { lat: report.latitude, lng: report.longitude, approximate: false };
  const found = approximateAreaCoordinates.find(item => item.match.test(report.location));
  return found ? { lat: found.lat, lng: found.lng, approximate: true } : null;
}
