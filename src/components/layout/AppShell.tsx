import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";

export function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppTopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
