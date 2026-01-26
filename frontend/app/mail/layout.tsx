import { Home, Mail, Settings, LogOut } from "lucide-react"; // アイコン用

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      {/* 簡易サイドバー */}
      <aside className="w-64 border-r p-4 flex flex-col gap-4">
        <h2 className="font-bold text-lg mb-4">ご教授ください</h2>
        <nav className="flex flex-col gap-2">
          <div className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"><Home size={20} /> ホーム</div>
          <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-600 rounded cursor-pointer"><Mail size={20} /> メール</div>
          <div className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"><Settings size={20} /> 語彙力判定</div>
        </nav>
        <div className="mt-auto flex items-center gap-2 p-2 text-red-500 cursor-pointer"><LogOut size={20} /> Logout</div>
      </aside>

      {/* メインコンテンツ（ここに各 page.tsx の中身が入る） */}
      <section className="flex-1 overflow-auto">
        {children}
      </section>
    </div>
  );
}