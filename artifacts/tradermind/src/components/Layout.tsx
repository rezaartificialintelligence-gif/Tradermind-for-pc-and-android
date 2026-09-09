import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/*
        دسکتاپ: padding-right برای sidebar (RTL) + بدون نوار بالا/پایین
        موبایل: padding-top برای نوار بالا + padding-bottom برای bottom nav
      */}
      <main
        className="md:pr-64 pt-16 md:pt-0 min-h-[100dvh] flex flex-col page-enter"
           style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        {/* روی دسکتاپ padding bottom را حذف می‌کنیم */}
        <style>{`@media (min-width: 768px) { main { padding-bottom: 0 !important; } }`}</style>
        <div className="flex-1 p-4 sm:p-5 md:p-8 max-w-[1440px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
