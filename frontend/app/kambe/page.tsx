// app/kambe/page.tsx
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function KambePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
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
