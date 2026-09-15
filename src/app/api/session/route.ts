import { currentUser } from "@/lib/auth";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  return json({ user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, locale: user.locale } : null });
}
