import GenerateClient from "./GenerateClient";
import PageMenu, { type PageMenuItem } from "@/components/PageMenu";

export default async function GeneratePage() {
  const menuItems: PageMenuItem[] = [{ label: "ログインへ", href: "/login" }];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(to_top,#fddb92_0%,#d1fdff_100%)] px-4 py-6">
      <PageMenu items={menuItems} className="fixed left-4 top-4 z-50" />
      <GenerateClient />
    </div>
  );
}
