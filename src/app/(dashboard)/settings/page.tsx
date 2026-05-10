"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";
import { 
  User, 
  Mail, 
  Shield, 
  Database,
  Cloud,
  Save,
  Languages,
  Loader2,
  AlertTriangle
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
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateProfile(auth.currentUser!, { displayName });
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleExportAllData = async () => {
    if (!user) return;
    setExportingData(true);
    try {
      const token = await user.getIdToken();
      // Fetch all jobs
      const res = await fetch("/api/tasks", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch your data");
      const jobs = await res.json();

      // Export as JSON file
      const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `docc_export_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${jobs.length} job record(s)`);
    } catch (error: any) {
      toast.error(error.message || "Export failed");
    } finally {
      setExportingData(false);
    }
  };

  const handleClearHistory = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete ALL your extraction history? This cannot be undone."
    );
    if (!confirmed) return;

    setClearingHistory(true);
    try {
      const token = await user.getIdToken();
      // Fetch all job IDs first
      const res = await fetch("/api/tasks", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const jobs = await res.json();

      // Delete each job
      let deleted = 0;
      for (const job of jobs) {
        const delRes = await fetch(`/api/tasks/${job._id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (delRes.ok) deleted++;
      }

      toast.success(`Cleared ${deleted} job record(s) from history`);
    } catch (error: any) {
      toast.error(error.message || "Failed to clear history");
    } finally {
      setClearingHistory(false);
    }
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
                <Input 
                  id="display-name" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name" 
                  className="rounded-xl border-gray-200" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="email" defaultValue={user?.email || ""} disabled className="pl-10 rounded-xl border-gray-200 bg-gray-50" />
                </div>
              </div>
            </div>
            <Button 
              onClick={handleSaveProfile} 
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8"
              disabled={savingProfile}
            >
              {savingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {savingProfile ? "Saving..." : "Save Changes"}
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

        {/* Security & Data */}
        <Card className="border-0 shadow-lg shadow-gray-200/50 rounded-2xl border border-white/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle>Security &amp; Data</CardTitle>
            </div>
            <CardDescription>Manage your security preferences and data retention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200 flex-1"
                onClick={handleExportAllData}
                disabled={exportingData}
              >
                {exportingData 
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Cloud className="h-4 w-4 mr-2" />
                }
                {exportingData ? "Exporting..." : "Export All Data"}
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200 text-rose-600 hover:bg-rose-50 hover:border-rose-100 flex-1"
                onClick={handleClearHistory}
                disabled={clearingHistory}
              >
                {clearingHistory
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Database className="h-4 w-4 mr-2" />
                }
                {clearingHistory ? "Clearing..." : "Clear All History"}
              </Button>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
              Clearing history permanently deletes all jobs and extracted data. This cannot be undone.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
