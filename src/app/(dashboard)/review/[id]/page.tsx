"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { 
  ArrowLeft, 
  Download, 
  Save, 
  RefreshCcw, 
  Trash2, 
  Edit2, 
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  FileSpreadsheet,
  Layers,
  Info,
  MoreHorizontal,
  Table as TableIcon,
  Columns
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

export default function ReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  const fetchRows = useCallback(async () => {
    if (!user || !id) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/tasks/${id}/rows`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch rows");
      const data = await response.json();
      setRows(data);
    } catch (error: any) {
      console.error("Fetch rows error:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    if (user && id) {
      fetchRows();
    } else if (!user && !loading) {
      // If no user and we're not already loading, we should check if auth is ready
      // But for now, we'll wait for the store to update
    }
  }, [user, id, fetchRows]);

  const handleEdit = (row: any) => {
    setEditingId(row._id);
    setEditData({ ...row.data });
  };

  const handleSave = async (rowId: string) => {
    setSaving(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/tasks/${id}/rows`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ rowId, data: editData })
      });

      if (!response.ok) throw new Error("Failed to update row");
      
      setRows(prev => prev.map(r => r._id === rowId ? { ...r, data: editData, isEdited: true } : r));
      setEditingId(null);
      toast.success("Changes saved successfully");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm("Are you sure you want to delete this row?")) return;
    // For now, local delete for UI speed, we'll sync with backend later if needed
    setRows(prev => prev.filter(r => r._id !== rowId));
    toast.success("Row removed locally");
  };

  const handleMergeSelected = () => {
    if (selectedRows.size < 2) return;
    const selectedList = rows.filter(r => selectedRows.has(r._id));
    const firstRow = selectedList[0];
    
    // Merge data from all selected rows
    const mergedData = { ...firstRow.data };
    selectedList.slice(1).forEach(row => {
      Object.keys(row.data).forEach(key => {
        if (mergedData[key] && row.data[key]) {
          mergedData[key] = `${mergedData[key]} | ${row.data[key]}`;
        } else if (row.data[key]) {
          mergedData[key] = row.data[key];
        }
      });
    });

    setRows(prev => {
      const newRows = prev.filter(r => !selectedRows.has(r._id) || r._id === firstRow._id);
      return newRows.map(r => r._id === firstRow._id ? { ...r, data: mergedData, isEdited: true } : r);
    });
    
    setSelectedRows(new Set());
    toast.success(`Merged ${selectedRows.size} rows`);
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredRows.map(r => r._id)));
    }
  };

  const toggleSelectRow = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) newSelected.delete(rowId);
    else newSelected.add(rowId);
    setSelectedRows(newSelected);
  };

  const handleExport = async () => {
    const toastId = toast.loading("Generating universal Excel file...");
    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/tasks/${id}/export`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `digitized_data_${id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Digitization complete! File downloaded.", { id: toastId });
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter(row => 
      JSON.stringify(row.data).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.rawText && row.rawText.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [rows, searchTerm]);

  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach(row => {
      Object.keys(row.data).forEach(key => keys.add(key));
    });
    return Array.from(keys).sort((a, b) => {
      if (a === "Content") return -1;
      if (b === "Content") return 1;
      return a.localeCompare(b);
    });
  }, [rows]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 animate-pulse">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
          <RefreshCcw className="h-8 w-8 text-indigo-600 animate-spin" />
        </div>
        <p className="text-gray-500 font-bold tracking-tight">ANALYZING SPATIAL DATA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      {/* Premium Sticky Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-40 bg-white/70 backdrop-blur-2xl py-4 sm:py-6 border-b -mx-6 px-6 sm:-mx-12 sm:px-12 transition-all">
        <div className="flex items-center gap-3 sm:gap-5">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-xl h-10 w-10 sm:h-12 sm:w-12 shadow-sm shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight truncate">Digitization Review</h1>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-black text-[10px] uppercase">
                {rows.length} Records
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">Original Language Preservation Mode</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {selectedRows.size > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 p-1 rounded-lg sm:rounded-xl border border-indigo-100 animate-in slide-in-from-right-4">
              <span className="text-[9px] sm:text-[10px] font-black text-indigo-700 uppercase px-1 sm:px-2">{selectedRows.size}</span>
              <Button size="sm" variant="ghost" className="h-7 sm:h-8 text-indigo-700 hover:bg-white rounded-lg px-2 text-xs" onClick={handleMergeSelected}>
                <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" /> <span className="hidden sm:inline">Merge</span>
              </Button>
              <Button size="sm" variant="ghost" className="h-7 sm:h-8 text-rose-600 hover:bg-white rounded-lg px-2 text-xs" onClick={() => {
                if(confirm(`Delete ${selectedRows.size} rows?`)) {
                  setRows(prev => prev.filter(r => !selectedRows.has(r._id)));
                  setSelectedRows(new Set());
                }
              }}>
                <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" /> <span className="hidden sm:inline">Delete</span>
              </Button>
            </div>
          )}
          
          <div className="relative flex-1 md:flex-initial min-w-[120px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Find..." 
              className="pl-9 h-10 sm:h-11 w-full md:w-48 bg-white/50 focus:bg-white rounded-xl border-gray-200 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Button 
            className="bg-gray-900 hover:bg-black h-10 sm:h-12 px-4 sm:px-8 rounded-xl sm:rounded-2xl shadow-xl shadow-gray-200 font-black text-white group text-xs sm:text-base"
            onClick={handleExport}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            Export <span className="hidden sm:inline">XLSX</span>
          </Button>
        </div>
      </div>

      <Card className="border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden rounded-[2rem] bg-white">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-gray-50/50 border-b border-gray-100">
                <TableHead className="w-12 text-center">
                  <Checkbox 
                    checked={selectedRows.size === filteredRows.length && filteredRows.length > 0}
                    onCheckedChange={toggleSelectAll}
                    className="rounded-md border-gray-300"
                  />
                </TableHead>
                <TableHead className="w-16 text-center font-black text-[10px] uppercase tracking-widest text-gray-400">Page</TableHead>
                {allKeys.map(key => (
                  <TableHead key={key} className="min-w-[200px] py-6">
                    <div className="flex items-center gap-2">
                      <Columns className="h-3 w-3 text-indigo-400" />
                      <span className="font-black text-[10px] uppercase tracking-widest text-gray-900">{key}</span>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-24 text-right px-8 font-black text-[10px] uppercase tracking-widest text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow 
                  key={row._id} 
                  className={`group transition-all hover:bg-indigo-50/20 ${row.isEdited ? "bg-indigo-50/10" : ""} ${selectedRows.has(row._id) ? "bg-indigo-50 border-l-4 border-l-indigo-600" : "border-l-4 border-l-transparent"}`}
                >
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={selectedRows.has(row._id)}
                      onCheckedChange={() => toggleSelectRow(row._id)}
                      className="rounded-md"
                    />
                  </TableCell>
                  <TableCell className="text-center font-black text-xs text-gray-400">{row.page}</TableCell>
                  
                  {allKeys.map(key => (
                    <TableCell key={key} className="py-4">
                      {editingId === row._id ? (
                        <Input 
                          value={editData[key] || ""} 
                          onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                          className="h-10 text-sm font-medium border-indigo-200 bg-white"
                        />
                      ) : (
                        <div className="group/cell relative">
                          <div className={`text-sm font-medium whitespace-pre-wrap leading-relaxed ${row.confidence < 0.7 ? "text-amber-700 bg-amber-50/50 px-2 py-1 rounded" : "text-gray-900"}`}>
                            {row.data[key] || <span className="text-gray-300 italic opacity-50">Empty</span>}
                          </div>
                          {row.confidence < 0.7 && key === "Content" && (
                            <div className="absolute -top-6 left-0 hidden group-hover/cell:block z-50 bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-xl">
                              Low Confidence OCR ({Math.round(row.confidence * 100)}%)
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                  ))}
                  
                  <TableCell className="text-right px-8">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingId === row._id ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-9 w-9 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl" onClick={() => handleSave(row._id)} disabled={saving}>
                            {saving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-xl" onClick={() => setEditingId(null)} disabled={saving}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-gray-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-3">Row Actions</DropdownMenuLabel>
                            <DropdownMenuItem className="rounded-xl cursor-pointer py-2.5 px-3" onClick={() => handleEdit(row)}>
                              <Edit2 className="h-4 w-4 mr-2.5 text-indigo-600" />
                              <span className="font-bold text-sm">Edit Record</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl cursor-pointer py-2.5 px-3" onClick={() => toggleSelectRow(row._id)}>
                              <Layers className="h-4 w-4 mr-2.5 text-indigo-600" />
                              <span className="font-bold text-sm">{selectedRows.has(row._id) ? "Deselect" : "Select for Merge"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-100 my-1 mx-2" />
                            <DropdownMenuItem className="rounded-xl cursor-pointer py-2.5 px-3 text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteRow(row._id)}>
                              <Trash2 className="h-4 w-4 mr-2.5" />
                              <span className="font-bold text-sm">Delete Row</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={allKeys.length + 3} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center">
                        <Search className="h-8 w-8 text-gray-200" />
                      </div>
                      <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">No matching records found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      
      {/* Footer Info */}
      <div className="flex items-center justify-between px-8 py-4 bg-gray-50 rounded-[2rem] border border-gray-100">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest tracking-widest">Language: Universal Detection</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Info className="h-3 w-3" />
            <span className="text-[10px] font-bold">Rows are automatically grouped by spatial coordinates.</span>
          </div>
        </div>
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Spatial Engine v2.0
        </div>
      </div>
    </div>
  );
}
