import { requireUser, json } from "@/lib/api";
import { userSelections } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/users/me/newsletters — the user's own selections. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  return json({ newsletters: userSelections(auth.user.id) });
}
