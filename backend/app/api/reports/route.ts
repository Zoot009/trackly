import { NextRequest } from "next/server";
import { ReportType } from "@flowace/shared";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { generateReport } from "@/services/reports";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "DAILY").toUpperCase() as ReportType;
  const employeeId = searchParams.get("employeeId");
  const report = await generateReport(
    Object.values(ReportType).includes(type) ? type : ReportType.DAILY,
    employeeId && employeeId !== "all" ? employeeId : null,
  );
  return ok(report);
});
