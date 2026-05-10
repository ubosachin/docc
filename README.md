# DocuExtract AI - PDF to Excel Platform

A production-grade web platform for extracting structured data from messy, multilingual government-style PDFs.

## 🚀 Features

- **Multilingual OCR**: Supports Hindi + English mixed text using Tesseract.js.
- **Smart Table Detection**: Specialized logic for voter lists and tabular records.
- **Asynchronous Pipeline**: Upload, queue, and process pages in the background.
- **Human Review Interface**: Interactive data grid for corrections before export.
- **Excel Export**: High-fidelity `.xlsx` generation using `exceljs`.
- **Firebase Backend**: Real-time status updates and secure file storage.

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, ShadCN UI
- **State Management**: Zustand, React Query
- **Backend**: Next.js API Routes, Firebase Admin SDK
- **Storage/DB**: Firebase Firestore, Storage, Authentication
- **Processing**: Tesseract.js, PDF.js, ExcelJS

## 📦 Getting Started

1. **Clone the project** and install dependencies:
   ```bash
   npm install
   ```

2. **Setup Environment Variables**:
   Create a `.env.local` file with your Firebase credentials:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...

   FIREBASE_PROJECT_ID=...
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY="..."
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `src/app/(dashboard)`: Protected dashboard routes (Overview, Upload, Review).
- `src/app/api/process`: Simulated background worker for OCR processing.
- `src/lib/ocr`: OCR engine logic using Tesseract.js.
- `src/lib/extraction`: Intelligent row detection patterns.
- `src/components/ui`: Custom ShadCN components with modern aesthetics.

## ⚠️ Important Implementation Details

- **Worker Simulation**: The `/api/process` route simulates a multi-step background worker. In production, this should be offloaded to Cloud Functions or a dedicated worker node.
- **OCR Quality**: For production use, consider using a server-side OCR service like AWS Textract or Azure Form Recognizer for higher accuracy on extremely blurred scans.
- **Voter List Pattern**: The current extractor uses regex patterns optimized for standard Indian voter list formats.
