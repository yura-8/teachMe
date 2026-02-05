import GenerateClient from "./GenerateClient";
import PageMenu, { type PageMenuItem } from "@/components/PageMenu";

export default async function GeneratePage() {
  const menuItems: PageMenuItem[] = [
    { label: "文章生成へ", href: "/generate" },
    { label: "メール作成へ", href: "/mail" },
    { label: "語彙へ", href: "/vocabulary" },
    { label: "語彙力へ", href: "/goiryoku" },
    { label: "ログアウト", href: "/logout" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(to_top,#fddb92_0%,#d1fdff_100%)] px-4 py-6">
      <PageMenu items={menuItems} className="fixed left-4 top-4 z-50" />
      <GenerateClient />
    </div>
  );
}
