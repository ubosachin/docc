"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Database,
  Cloud,
  Save,
  Languages
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuthStore();

  const handleSave = () => {
    toast.success("Settings saved successfully");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account preferences and extraction configurations.</p>
      </div>

      <div className="grid gap-6">
        {/* Profile Settings */}
        <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl border border-white/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <User className="h-5 w-5" />
              </div>
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>Update your personal details and how others see you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input id="display-name" defaultValue={user?.displayName || ""} placeholder="John Doe" className="rounded-xl border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="email" defaultValue={user?.email || ""} disabled className="pl-10 rounded-xl border-gray-200 bg-gray-50" />
                </div>
              </div>
            </div>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Extraction Settings */}
        <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl border border-white/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Languages className="h-5 w-5" />
              </div>
              <CardTitle>Extraction Preferences</CardTitle>
            </div>
            <CardDescription>Configure how the AI handles different document types.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-ocr" className="text-base">Auto-OCR for Scanned PDFs</Label>
                <p className="text-xs text-gray-500">Automatically switch to OCR when text layer is missing.</p>
              </div>
              <Switch id="auto-ocr" defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="preserve-spatial" className="text-base">Preserve Spatial Formatting</Label>
                <p className="text-xs text-gray-500">Maintain original X-Y coordinates during table reconstruction.</p>
              </div>
              <Switch id="preserve-spatial" defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl border border-white/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle>Security & Data</CardTitle>
            </div>
            <CardDescription>Manage your security preferences and data retention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex flex-col md:flex-row gap-4">
               <Button variant="outline" className="rounded-xl border-gray-200 flex-1">
                 <Cloud className="h-4 w-4 mr-2" />
                 Export All Data
               </Button>
               <Button variant="outline" className="rounded-xl border-gray-200 text-rose-600 hover:bg-rose-50 hover:border-rose-100 flex-1">
                 <Database className="h-4 w-4 mr-2" />
                 Clear History
               </Button>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
