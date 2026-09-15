import { listCompanies } from "@/lib/queries";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/companies — public projection only. */
export async function GET() {
  return json({ companies: listCompanies() });
}
