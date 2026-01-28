// app/kambe/page.tsx
import { auth, signOut } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function KambePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user?.email) {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    const proto = requestHeaders.get("x-forwarded-proto") ?? "http";

    await fetch(`${proto}://${host}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: session.user.email,
        name: session.user.name,
        avatar_url: session.user.image,
      }),
      cache: "no-store",
    });
  }

  return (
    <div>
      //test用です、ログアウトボタン用意しました。
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit">ログアウト</button>
      </form>
    </div>
  );
}
