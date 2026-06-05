import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";

export function AppShell() {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <AppSidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar />
        <main className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-6 overscroll-contain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
