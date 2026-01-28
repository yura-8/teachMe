import { Home, Mail, Settings, LogOut } from "lucide-react";

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-72 p-6">
          <div className="rounded-2xl bg-white shadow-sm border p-5 flex flex-col gap-4 h-[calc(100vh-3rem)]">
            <h2 className="font-bold text-lg">ご教授ください</h2>

            <nav className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                <Home size={18} /> ホーム
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg cursor-pointer font-semibold">
                <Mail size={18} /> メール
              </div>
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                <Settings size={18} /> 語彙力判定
              </div>
            </nav>

            <div className="mt-auto">
              <div className="flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                <LogOut size={18} /> Logout
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-10 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
