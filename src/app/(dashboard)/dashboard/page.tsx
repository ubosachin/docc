"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Download,
  Eye,
  Table as TableIcon,
  Search,
  Trash2,
  Plus,
  RefreshCcw,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface Job {
  _id: string;
  filename: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  totalPages: number;
  processedPages: number;
  progress: number;
  currentStep?: string;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "processing" | "completed" | "failed">("all");

  const fetchJobs = useCallback(async (showLoading = false) => {
    // user not ready yet (Firebase auth still initialising) — silently skip,
    // the effect will re-run once `user` changes from null → User object.
    if (!user) {
      setLoading(false);
      return;
    }
    if (showLoading) setRefreshing(true);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/tasks", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch jobs");
      }
      
      const data = await response.json();
      setJobs(data);
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      toast.error(error.message || "Failed to sync your tasks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Only start fetching once the auth state is known
  const { loading: authLoading } = useAuthStore();
  useEffect(() => {
    if (authLoading) return; // wait for Firebase to resolve
    fetchJobs();
  }, [fetchJobs, authLoading]);

  // Stable polling: derive hasActiveJobs outside the deps array
  const hasActiveJobs = jobs.some(j => j.status === "processing" || j.status === "queued");
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchJobs();
    }, hasActiveJobs ? 3000 : 15000);
    return () => clearInterval(interval);
  }, [user, hasActiveJobs, fetchJobs]);

  const handleDownload = async (jobId: string) => {
    const toastId = toast.loading("Preparing Excel download...");
    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/tasks/${jobId}/export`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `digitized_data_${jobId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download started!", { id: toastId });
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/tasks/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Delete failed");

      toast.success("Task deleted successfully");
      fetchJobs();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const jobStatus = job.status?.toLowerCase();
    const searchLower = searchTerm.trim().toLowerCase();
    
    const matchesSearch = !searchLower || job.filename?.toLowerCase().includes(searchLower);
    const matchesTab = activeTab === "all" || 
                      (activeTab === "processing" && (jobStatus === "processing" || jobStatus === "queued")) ||
                      activeTab === jobStatus;
    
    return matchesSearch && matchesTab;
  });

  const stats = {
    total: jobs.length,
    completed: jobs.filter(j => j.status === "completed").length,
    processing: jobs.filter(j => j.status === "processing" || j.status === "queued").length,
    failed: jobs.filter(j => j.status === "failed").length,
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Extraction Dashboard</h1>
          <p className="text-gray-500 mt-1">High-accuracy PDF to Excel processing platform.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button 
            variant="outline" 
            size="icon" 
            className="h-11 w-11 text-gray-500" 
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
           >
             <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
           </Button>
           <Link href="/upload">
             <Button className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-lg shadow-indigo-100 flex items-center gap-2">
               <Plus className="h-4 w-4" />
               New Upload
             </Button>
           </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Tasks" 
          value={stats.total} 
          icon={<FileText className="h-5 w-5" />} 
          variant="indigo"
        />
        <StatsCard 
          title="Completed" 
          value={stats.completed} 
          icon={<CheckCircle2 className="h-5 w-5" />} 
          variant="emerald"
        />
        <StatsCard 
          title="Processing" 
          value={stats.processing} 
          icon={<Clock className="h-5 w-5" />} 
          variant="amber"
        />
        <StatsCard 
          title="Failed" 
          value={stats.failed} 
          icon={<AlertCircle className="h-5 w-5" />} 
          variant="rose"
        />
      </div>

      {/* Recent Uploads Table */}
      <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/70 backdrop-blur-sm overflow-hidden rounded-2xl border border-white/20">
        <CardHeader className="border-b bg-gray-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 px-8">
          <div>
            <CardTitle className="text-xl font-bold">Recent Extractions</CardTitle>
            <CardDescription>Monitor your document processing status in real-time.</CardDescription>
          </div>
          <div className="flex items-center bg-gray-200/50 p-1 rounded-xl">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} label="All" count={stats.total} />
            <TabButton active={activeTab === "processing"} onClick={() => setActiveTab("processing")} label="Active" count={stats.processing} />
            <TabButton active={activeTab === "completed"} onClick={() => setActiveTab("completed")} label="Done" count={stats.completed} />
            <TabButton active={activeTab === "failed"} onClick={() => setActiveTab("failed")} label="Failed" count={stats.failed} />
          </div>
          <div className="relative w-64 hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Quick find..." 
              className="pl-10 h-10 border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 transition-all rounded-xl text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <RefreshCcw className="h-10 w-10 text-indigo-600 animate-spin" />
              <p className="text-gray-500 font-medium">Fetching your documents...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
                <TableIcon className="h-10 w-10 text-indigo-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Start your first extraction</h3>
              <p className="text-gray-500 mt-2 max-w-sm mb-8 text-pretty">
                Upload a PDF document to begin. We'll automatically detect tables and extract data with high fidelity.
              </p>
              <Link href="/upload">
                <Button className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                  Upload PDF Now
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-gray-50/50">
                    <TableHead className="font-bold text-gray-600 px-8 h-14">Document</TableHead>
                    <TableHead className="font-bold text-gray-600 h-14">Status</TableHead>
                    <TableHead className="font-bold text-gray-600 h-14">Progress</TableHead>
                    <TableHead className="font-bold text-gray-600 h-14">Date Created</TableHead>
                    <TableHead className="font-bold text-gray-600 text-right px-8 h-14">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job._id} className="hover:bg-indigo-50/30 transition-colors group">
                      <TableCell className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 truncate max-w-[200px] sm:max-w-xs">
                              {job.filename}
                            </div>
                            <div className="text-xs text-gray-400 font-mono mt-0.5">{job._id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 max-w-[150px]">
                          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <span>{job.status === "completed" ? "Done" : "Processing"}</span>
                            <span>{Math.round(job.progress || 0)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                job.status === "completed" ? "bg-emerald-500" : 
                                job.status === "failed" ? "bg-rose-500" : "bg-indigo-600"
                              }`}
                              style={{ width: `${job.progress || 0}%` }}
                            />
                          </div>
                          {job.currentStep && (
                            <div className="text-[10px] text-gray-400 truncate w-full italic">
                              {job.currentStep}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 font-medium">
                        {job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : "-"}
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <div className="flex items-center justify-end gap-2">
                           {job.status === "completed" && (
                             <>
                               <Button 
                                 variant="outline" 
                                 size="icon" 
                                 className="h-9 w-9 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all rounded-lg"
                                 onClick={() => handleDownload(job._id)}
                                 title="Direct Download"
                               >
                                 <Download className="h-4 w-4" />
                               </Button>
                               <Link href={`/review/${job._id}`}>
                                 <Button variant="outline" size="sm" className="h-9 px-4 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all rounded-lg">
                                   <Eye className="h-4 w-4 mr-2" />
                                   Review
                                 </Button>
                               </Link>
                             </>
                           )}
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-9 w-9 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                             onClick={() => handleDelete(job._id)}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ title, value, icon, variant }: { title: string; value: number; icon: React.ReactNode; variant: string }) {
  const styles: any = {
    indigo: "bg-indigo-50/50 text-indigo-600 border-indigo-100/50",
    emerald: "bg-emerald-50/50 text-emerald-600 border-emerald-100/50",
    amber: "bg-amber-50/50 text-amber-600 border-amber-100/50",
    rose: "bg-rose-50/50 text-rose-600 border-rose-100/50",
  };

  return (
    <Card className="border shadow-lg shadow-gray-100/50 bg-white/80 backdrop-blur-sm rounded-2xl transition-all hover:translate-y-[-2px] hover:shadow-xl">
      <CardContent className="p-6">
        <div className="flex items-center gap-5">
          <div className={`p-4 rounded-2xl border ${styles[variant]}`}>
            {icon}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
            <h3 className="text-3xl font-black text-gray-900 mt-0.5">{value}</h3>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
        active 
          ? "bg-white text-indigo-600 shadow-sm" 
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
      }`}
    >
      {label}
      <Badge variant="outline" className={`h-5 min-w-5 flex items-center justify-center p-0 border-none text-[10px] ${active ? "bg-indigo-50 text-indigo-600" : "bg-gray-200 text-gray-500"}`}>
        {count}
      </Badge>
    </button>
  );
}

function StatusBadge({ status }: { status: Job["status"] }) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Completed</Badge>;
    case "processing":
      return <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">Processing</Badge>;
    case "queued":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Queued</Badge>;
    case "failed":
      return <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Failed</Badge>;
    default:
      return <Badge variant="outline" className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{status}</Badge>;
  }
}
