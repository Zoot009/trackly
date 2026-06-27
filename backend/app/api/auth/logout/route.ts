import { handler, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const res = ok({ success: true });
  res.cookies.delete("flowace_token");
  return res;
});
