"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { 
  CloudUpload, 
  File, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { db } from "@/lib/firebase/clientApp";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

const { useUploadThing } = generateReactHelpers<OurFileRouter>();

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuthStore();
  const router = useRouter();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      if (selectedFile.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setFile(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading
  });

  const { startUpload } = useUploadThing("pdfUploader", {
    headers: async () => {
      const token = await user?.getIdToken();
      return { Authorization: `Bearer ${token}` };
    },
    onClientUploadComplete: async (res) => {
      const uploadedFile = res[0];
      const { jobId, uploadId } = uploadedFile.serverData as any;
      
      try {
        // Trigger processing
        const processResponse = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId })
        });
        
        if (!processResponse.ok) {
          throw new Error("Failed to start processing");
        }

        toast.success("File uploaded and processing started!");
        router.push(`/dashboard`);
      } catch (error: any) {
        toast.error("Upload successful, but processing failed to start: " + error.message);
        setUploading(false);
      }
    },
    onUploadProgress: (p) => {
      setProgress(p);
    },
    onUploadError: (error) => {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
    },
    onUploadBegin: () => {
      setUploading(true);
    }
  });

  const handleUpload = async () => {
    if (!file || !user) return;
    
    // Uploadthing needs the token in headers, which I'll handle in the hook
    // Actually, Uploadthing uses its own auth via middleware
    await startUpload([file]);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">New Extraction Task</h1>
        <p className="text-gray-500 mt-2">Upload your PDF documents to extract structured tabular data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2 border-dashed bg-white/50 backdrop-blur-sm border-indigo-100 hover:border-indigo-300 transition-colors">
            <CardContent className="p-0">
              <div 
                {...getRootProps()} 
                className={`flex flex-col items-center justify-center py-20 px-6 cursor-pointer outline-none ${isDragActive ? "bg-indigo-50/50" : ""}`}
              >
                <input {...getInputProps()} />
                <div className="bg-indigo-100 p-4 rounded-2xl text-indigo-600 mb-4 ring-8 ring-indigo-50">
                  <CloudUpload className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {isDragActive ? "Drop the PDF here" : "Click or drag PDF to upload"}
                </h3>
                <p className="text-gray-500 text-sm mb-6 text-center max-w-xs">
                  Supports scanned voter lists, registry docs, and tabular records (up to 500MB).
                </p>
                <Button variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 h-11 px-8">
                  Select File
                </Button>
              </div>
            </CardContent>
          </Card>

          {file && (
            <Card className="bg-white border-indigo-100 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              <div className="p-4 flex items-center justify-between border-b bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white border rounded-lg shadow-sm">
                    <File className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold truncate max-w-[200px] sm:max-w-md">{file.name}</div>
                    <div className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                  </div>
                </div>
                {!uploading && (
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <div className="p-6">
                {uploading ? (
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-indigo-600">Uploading to cloud storage...</span>
                      <span className="text-gray-500 font-mono">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2 bg-indigo-50" indicatorClassName="bg-indigo-600" />
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-12 shadow-lg shadow-indigo-100" 
                      onClick={handleUpload}
                    >
                      Start Processing
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="h-12 px-8" onClick={() => setFile(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Upload Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                <GuidelineItem icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="PDF files only" />
                <GuidelineItem icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Max size: 500MB per file" />
                <GuidelineItem icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Multi-column support enabled" />
                <GuidelineItem icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Hindi & English supported" />
                <GuidelineItem icon={<Clock className="h-4 w-4 text-indigo-500" />} text="Processing takes ~5s per page" />
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
            <CardHeader>
              <CardTitle className="text-lg">Enterprise Ready</CardTitle>
              <CardDescription className="text-indigo-100">Need to process 10,000+ pages?</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-indigo-50 text-pretty">
                Contact our sales team for high-priority dedicated worker nodes and custom extraction templates.
              </p>
              <Button variant="secondary" className="w-full mt-6 bg-white text-indigo-600 hover:bg-indigo-50 border-0">
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GuidelineItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-gray-600">
      <div className="mt-0.5">{icon}</div>
      <span>{text}</span>
    </li>
  );
}
