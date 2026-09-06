import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background surface-grid">
      <Sidebar />
      {/*
        دسکتاپ: padding-right برای sidebar (RTL) + بدون نوار بالا/پایین
        موبایل: padding-top برای نوار بالا + padding-bottom برای bottom nav
      */}
      <main
        className="md:pr-72 pt-14 md:pt-0 min-h-[100dvh] flex flex-col"
        style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
      >
        {/* روی دسکتاپ padding bottom را حذف می‌کنیم */}
        <style>{`@media (min-width: 768px) { main { padding-bottom: 0 !important; } }`}</style>
        <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1480px] mx-auto w-full page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
