import mongoose, { Schema, Document } from "mongoose";

// User Model (Matches Firebase Auth UID)
export interface IUser extends Document {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    displayName: { type: String },
    photoURL: { type: String },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

// Upload Model
export interface IUpload extends Document {
  userId: string;
  filename: string;
  fileUrl: string;
  fileKey: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

const UploadSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    filename: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileKey: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
  },
  { timestamps: true }
);

export const Upload = mongoose.models.Upload || mongoose.model<IUpload>("Upload", UploadSchema);

// Job Model
export interface IJob extends Document {
  userId: string;
  uploadId: mongoose.Types.ObjectId;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  currentStep: string;
  totalPages: number;
  processedPages: number;
  languages: string[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    uploadId: { type: Schema.Types.ObjectId, ref: "Upload", required: true },
    status: { 
      type: String, 
      enum: ["queued", "processing", "completed", "failed"], 
      default: "queued" 
    },
    progress: { type: Number, default: 0 },
    currentStep: { type: String },
    totalPages: { type: Number, default: 0 },
    processedPages: { type: Number, default: 0 },
    languages: { type: [String], default: ["eng"] },
    error: { type: String },
  },
  { timestamps: true }
);

export const Job = mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema);

// ExtractedRow Model
export interface IExtractedRow extends Document {
  jobId: mongoose.Types.ObjectId;
  page: number;
  rowIndex: number;
  data: Record<string, any>;
  rawText?: string;
  confidence: number;
  isEdited: boolean;
  createdAt: Date;
}

const ExtractedRowSchema: Schema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    page: { type: Number, required: true },
    rowIndex: { type: Number, required: true },
    data: { type: Map, of: Schema.Types.Mixed, required: true },
    rawText: { type: String },
    confidence: { type: Number, default: 1 },
    isEdited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ExtractedRow = 
  mongoose.models.ExtractedRow || 
  mongoose.model<IExtractedRow>("ExtractedRow", ExtractedRowSchema);

// Export Model
export interface IExport extends Document {
  jobId: mongoose.Types.ObjectId;
  userId: string;
  filename: string;
  fileUrl: string;
  fileKey: string;
  format: "xlsx" | "csv";
  createdAt: Date;
}

const ExportSchema: Schema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    userId: { type: String, required: true, index: true },
    filename: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileKey: { type: String, required: true },
    format: { type: String, enum: ["xlsx", "csv"], required: true },
  },
  { timestamps: true }
);

export const Export = mongoose.models.Export || mongoose.model<IExport>("Export", ExportSchema);

// Template Model
export interface ITemplate extends Document {
  userId: string;
  name: string;
  description?: string;
  columnMap: Record<string, string>;
  createdAt: Date;
}

const TemplateSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    columnMap: { type: Map, of: String },
  },
  { timestamps: true }
);

export const Template = mongoose.models.Template || mongoose.model<ITemplate>("Template", TemplateSchema);
