"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { 
  FileText, 
  History as HistoryIcon,
  Search,
  RefreshCcw,
  Eye,
  Download,
  Trash2,
  Calendar,
  Filter
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
import { format } from "date-fns";

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

export default function HistoryPage() {
  const { user } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "completed" | "failed">("all");

  const fetchJobs = useCallback(async (showLoading = false) => {
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
      
      if (!response.ok) throw new Error("Failed to fetch history");
      
      const data = await response.json();
      setJobs(data);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const { loading: authLoading } = useAuthStore();
  useEffect(() => {
    if (authLoading) return;
    fetchJobs();
  }, [fetchJobs, authLoading]);

  const hasActiveJobs = jobs.some(j => j.status === "processing" || j.status === "queued");
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchJobs();
    }, hasActiveJobs ? 3000 : 20000);
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
    if (!confirm("Are you sure you want to delete this task record?")) return;

    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/tasks/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Delete failed");

      toast.success("Task record deleted");
      fetchJobs();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const jobStatus = job.status?.toLowerCase();
    const searchLower = searchTerm.trim().toLowerCase();
    
    const matchesSearch = !searchLower || job.filename?.toLowerCase().includes(searchLower);
    const matchesTab = activeTab === "all" || activeTab === jobStatus;
    
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Processing History</h1>
          <p className="text-gray-500 mt-1">Audit and review all your previous document extractions.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button 
            variant="outline" 
            size="sm" 
            className="h-10 text-gray-500" 
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
           >
             <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
             Refresh
           </Button>
        </div>
      </div>

      <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/70 backdrop-blur-sm overflow-hidden rounded-2xl border border-white/20">
        <div className="border-b bg-gray-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4 py-6 px-8">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} label="All History" count={jobs.length} />
            <TabButton active={activeTab === "completed"} onClick={() => setActiveTab("completed")} label="Completed" count={jobs.filter(j => j.status === "completed").length} />
            <TabButton active={activeTab === "failed"} onClick={() => setActiveTab("failed")} label="Failed" count={jobs.filter(j => j.status === "failed").length} />
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Filter..." 
              className="pl-10 h-10 border-gray-200 bg-white/50 focus:bg-white transition-all rounded-xl text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <RefreshCcw className="h-10 w-10 text-indigo-600 animate-spin" />
              <p className="text-gray-500 font-medium">Loading history...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-6">
                <HistoryIcon className="h-10 w-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">No history found</h3>
              <p className="text-gray-500 mt-2 max-w-sm">
                You haven't processed any documents yet or your search query returned no results.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-gray-50/50">
                    <TableHead className="font-bold text-gray-600 px-8 h-14">Document Name</TableHead>
                    <TableHead className="font-bold text-gray-600 h-14">Status</TableHead>
                    <TableHead className="font-bold text-gray-600 h-14">Pages</TableHead>
                    <TableHead className="font-bold text-gray-600 h-14">Processed On</TableHead>
                    <TableHead className="font-bold text-gray-600 text-right px-8 h-14">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job._id} className="hover:bg-indigo-50/30 transition-colors group">
                      <TableCell className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 bg-gray-50 rounded-xl text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 truncate max-w-[200px] sm:max-w-xs">
                              {job.filename}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{job._id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-gray-600">
                          {job.totalPages || 0} Pages
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 font-medium">
                        {job.createdAt ? format(new Date(job.createdAt), "MMM d, yyyy • HH:mm") : "-"}
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
                                   View Results
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
