import { signOut } from "@/auth";

export async function GET() {
  // Server-side logout without showing a UI page.
  // signOut() triggers a redirect by default.
  await signOut({ redirectTo: "/login" });
  return new Response(null, { status: 204 });
}

