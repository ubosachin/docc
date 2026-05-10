"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { 
  LayoutDashboard, 
  Upload, 
  History, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Plus
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { auth } from "@/lib/firebase/clientApp";
import { signOut } from "firebase/auth";
import { toast } from "sonner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      router.push("/");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50/50">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } transition-all duration-300 ease-in-out border-r bg-white flex flex-col hidden md:flex`}
      >
        <div className="h-20 flex items-center px-6 border-b">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl">
              <Image 
                src="/logo.png" 
                alt="Docc Logo" 
                fill 
                sizes="40px"
                className="object-cover scale-150"
                priority
              />
            </div>
            {isSidebarOpen && <span className="font-bold text-2xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">Docc</span>}
          </Link>
        </div>

        <ScrollArea className="flex-1 px-4 py-6">
          <div className="space-y-2">
            <SidebarItem 
              href="/dashboard" 
              icon={<LayoutDashboard className="h-5 w-5" />} 
              label="Overview" 
              isOpen={isSidebarOpen} 
            />
            <SidebarItem 
              href="/upload" 
              icon={<Upload className="h-5 w-5" />} 
              label="New Extraction" 
              isOpen={isSidebarOpen} 
            />
            <SidebarItem 
              href="/history" 
              icon={<History className="h-5 w-5" />} 
              label="Processing History" 
              isOpen={isSidebarOpen} 
            />
            <SidebarItem 
              href="/settings" 
              icon={<Settings className="h-5 w-5" />} 
              label="Settings" 
              isOpen={isSidebarOpen} 
            />
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-4">
          {isSidebarOpen && (
            <div className="px-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Account</div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                  {user.displayName?.charAt(0) || user.email?.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-medium truncate">{user.displayName || "User"}</div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                </div>
              </div>
            </div>
          )}
          <Button 
            variant="ghost" 
            className={`w-full justify-start text-gray-500 hover:text-red-600 hover:bg-red-50 ${!isSidebarOpen && "px-2"}`}
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            {isSidebarOpen && <span className="ml-3">Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
             <Button 
               variant="ghost" 
               size="icon" 
               className="md:hidden"
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             >
               <Menu className="h-6 w-6" />
             </Button>
             <h1 className="text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 md:hidden">Docc</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/upload">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarItem({ href, icon, label, isOpen }: { href: string; icon: React.ReactNode; label: string; isOpen: boolean }) {
  return (
    <Link 
      href={href}
      className="flex items-center p-3 rounded-xl text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-200"
    >
      {icon}
      {isOpen && <span className="ml-3 font-medium">{label}</span>}
    </Link>
  );
}
