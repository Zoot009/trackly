import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({ status: "ok", service: "trackly-backend", time: new Date().toISOString() });
}
