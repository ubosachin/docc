import { createUploadthing, type FileRouter } from "uploadthing/next";
import { adminAuth } from "@/lib/firebase/admin";
import dbConnect from "@/lib/db/mongodb";
import { Upload, Job } from "@/lib/db/models";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "128MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Get the auth header
      const authHeader = req.headers.get("authorization");
      console.log("Uploadthing Middleware: Auth Header received:", authHeader ? "Yes" : "No");

      if (!authHeader?.startsWith("Bearer ")) {
        console.error("Uploadthing Middleware: Missing or invalid Authorization header");
        throw new Error("Unauthorized");
      }

      try {
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth().verifyIdToken(idToken);
        console.log("Uploadthing Middleware: Auth successful for UID:", decodedToken.uid);
        return { userId: decodedToken.uid };
      } catch (error: any) {
        console.error("Uploadthing Middleware: Firebase Auth verify failed:", error.message);
        throw new Error("Invalid token");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("File URL:", file.ufsUrl);

      await dbConnect();
      
      const upload = await Upload.create({
        userId: metadata.userId,
        filename: file.name,
        fileUrl: file.ufsUrl,
        fileKey: file.key,
        size: file.size,
        mimeType: file.type || "application/pdf",
      });

      const job = await Job.create({
        userId: metadata.userId,
        uploadId: upload._id,
        status: "queued",
        currentStep: "File uploaded successfully",
        progress: 0,
      });

      return { 
        uploadedBy: metadata.userId, 
        url: file.ufsUrl,
        uploadId: upload._id,
        jobId: job._id
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
