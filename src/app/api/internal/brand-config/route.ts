import { requireRole, json, err, body, ADMIN } from "@/lib/api";
import { setBrandValue, getBrand } from "@/lib/brand";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** GET/POST /api/internal/brand-config — rebrandability without schema migration (§24/§26). */
export async function GET(request: Request) {
  const auth = await requireRole(request, ADMIN);
  if ("error" in auth) return auth.error;
  return json({ brand: getBrand() });
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ADMIN);
  if ("error" in auth) return auth.error;
  const b = await body<Record<string, string>>(request);
  if (!b) return err("auth.errGeneric", 400);
  let changed = 0;
  for (const [key, value] of Object.entries(b)) {
    if (!key.startsWith("brand.") || typeof value !== "string") continue;
    setBrandValue(key, value);
    logAudit(auth.user.id, "brand.config_changed", "brand_config", key, { value });
    changed++;
  }
  return json({ ok: true, changed, brand: getBrand() });
}
