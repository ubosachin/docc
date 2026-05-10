# Docc - Intelligent Multilingual PDF Digitization

**Docc** is a production-grade web platform designed to extract structured tabular data from complex, multilingual, and scanned government documents (such as Indian voter lists). It combines advanced spatial layout analysis with high-precision OCR to transform messy PDFs into clean, editable Excel files.

---

## 🚀 Key Features

- **Hybrid Extraction Pipeline**: Automatically switches between direct text extraction and high-DPI OCR based on document type.
- **Multilingual OCR Support**: Specialized for mixed Hindi and English text using Tesseract.js with custom preprocessing.
- **Spatial Table Reconstruction**: Intelligent grouping of text elements based on coordinate geometry to preserve original table layouts.
- **Review & Refine Dashboard**: Interactive data grid for human-in-the-loop validation, merging records, and correcting OCR errors.
- **High-Fidelity Export**: Generates professional `.xlsx` files with column mapping and data validation.
- **Scalable Architecture**: Decoupled client/server PDF logic designed to handle large files with Next.js 16 and Turbopack.

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router + Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0 + ShadCN UI
- **Database**: MongoDB (Mongoose)
- **Authentication**: Firebase Auth (Admin SDK)
- **File Storage**: [Uploadthing](https://uploadthing.com/)
- **PDF Engine**: [PDF.js 4.x](https://mozilla.github.io/pdf.js/) (Legacy Build)
- **OCR Engine**: [Tesseract.js](https://tesseract.projectnaptha.com/)
- **Image Processing**: Sharp + Node-Canvas
- **Export**: ExcelJS

## 📦 Getting Started

### 1. Prerequisites
- Node.js 20+
- MongoDB instance (local or Atlas)
- Firebase Project (for Authentication)
- Uploadthing Account

### 2. Installation
```bash
git clone https://github.com/ubosachin/docc.git
cd docc
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory:
```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string

# Uploadthing
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=...

# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase (Admin)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### 4. Running Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🏗️ Core Architecture

### PDF.js v4 + Server-Side Rendering
To ensure stability in a serverless/Node.js environment, the project implements a strict separation of PDF logic:
- **`serverPdf.ts`**: Uses `disableWorker: true` and `CanvasFactory` (via `node-canvas`) for reliable server-side image generation and text analysis.
- **`clientPdf.ts`**: Configures the browser worker using Turbopack-optimized asset URLs for UI previews.

### OCR Pipeline
1. **DPI Upscaling**: PDFs are converted to 400 DPI images to capture fine Hindi glyphs.
2. **Preprocessing**: Grayscale conversion and thresholding via `sharp`.
3. **Segmentation**: Spatial grouping of OCR results into logical rows and columns.

## 📂 Project Structure

- `src/app/(dashboard)`: Core application interface (Upload, Review, History).
- `src/app/api/process`: Orchestration of the multi-page extraction worker.
- `src/lib/extraction`: Specialized spatial analysis and table reconstruction logic.
- `src/lib/pdf`: Unified client/server PDF initialization utilities.
- `src/types`: Custom TypeScript declarations (including `?url` asset patterns).

---

## 📄 License
This project is private and intended for internal use.

## 🤝 Support
For enterprise support or custom extraction templates, contact the development team.
