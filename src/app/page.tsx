"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  FileSpreadsheet, 
  Zap, 
  Shield, 
  CheckCircle2, 
  ArrowRight,
  Globe,
  Database,
  Search,
  Sparkles,
  ChevronRight,
  Languages,
  Layers,
  Layout,
  MousePointer2 
} from "lucide-react";
import Image from "next/image";

import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";
import { toast } from "sonner";

export default function LandingPage() {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to login with Google");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] selection:bg-indigo-100 selection:text-indigo-900">
      {/* Premium Navigation */}
      <header className={`px-6 lg:px-12 h-20 flex items-center border-b sticky top-0 z-50 transition-all duration-500 ${scrolled ? "bg-white/70 backdrop-blur-2xl border-gray-200 shadow-sm" : "bg-transparent border-transparent"}`}>
        <Link className="flex items-center justify-center group" href="/">
          <div className="relative h-10 w-10 overflow-hidden rounded-xl rotate-[-6deg] group-hover:rotate-0 transition-all duration-500 shadow-lg shadow-indigo-200">
            <Image 
              src="/logo.png" 
              alt="Docc Logo" 
              fill 
              sizes="40px"
              className="object-cover scale-150"
            />
          </div>
          <span className="ml-3 text-2xl font-black tracking-tight text-gray-900">Docc</span>
        </Link>
        <nav className="ml-auto flex gap-8 items-center">
          <Link className="text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors hidden md:block" href="#features">
            Capabilities
          </Link>
          <Link className="text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors hidden md:block" href="#engine">
            The Engine
          </Link>
          <div className="h-4 w-[1px] bg-gray-200 mx-2 hidden md:block" />
          <Link href="/login">
            <Button variant="ghost" className="font-bold text-gray-600 px-6 hover:bg-gray-50">Log in</Button>
          </Link>
          <Link href="/register">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 px-8 rounded-2xl shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02]">
              Try Free
            </Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 lg:pt-40 lg:pb-56 overflow-hidden">
          {/* Background Decorative Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100/40 blur-[150px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100/30 blur-[120px] rounded-full" />
          </div>

          <div className="container px-6 mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-100 px-5 py-2.5 text-[10px] font-black text-gray-500 mb-10 shadow-xl shadow-gray-100/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="uppercase tracking-[0.2em]">Universal Multilingual Extraction Platform</span>
            </div>
            
            <h1 className="text-6xl md:text-9xl font-black tracking-tighter mb-10 text-gray-900 leading-[0.85] animate-in fade-in slide-in-from-bottom-8 duration-700">
              Preserve <span className="text-indigo-600">Language.</span> <br />
              Protect <span className="relative">Structure. <div className="absolute -bottom-2 left-0 w-full h-4 bg-emerald-100 -z-10 rotate-[-1deg]" /></span>
            </h1>
            
            <p className="max-w-[850px] mx-auto text-gray-500 text-xl md:text-2xl mb-14 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000">
              The world's first PDF-to-Excel engine that guarantees zero translation, zero hallucination, 
              and 100% Unicode fidelity. Whether it's Hindi, Arabic, Japanese, or mixed scripts—we extract exactly what's there.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-6 items-center animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-300">
              <Link href="/register">
                <Button size="lg" className="h-16 px-12 bg-gray-900 hover:bg-black text-white font-black text-xl rounded-[1.5rem] shadow-2xl shadow-gray-300 group">
                  Start Digitization
                  <ArrowRight className="ml-2.5 h-6 w-6 group-hover:translate-x-1.5 transition-transform" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-16 px-12 text-xl font-bold border-gray-200 bg-white hover:bg-gray-50 rounded-[1.5rem] shadow-xl shadow-gray-100/50"
                onClick={handleGoogleLogin}
              >
                <svg className="mr-4 h-6 w-6" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Google Login
              </Button>
            </div>
          </div>
        </section>

        {/* Engine Visualization */}
        <section id="engine" className="pb-40 px-6">
          <div className="container mx-auto">
            <div className="relative group max-w-7xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-[3rem] blur-2xl opacity-10 group-hover:opacity-20 transition duration-1000"></div>
              <div className="relative bg-white border border-gray-100 rounded-[3rem] shadow-2xl overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12">
                  <div className="lg:col-span-7 p-8 md:p-20 space-y-12">
                    <div className="space-y-6">
                      <div className="inline-flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-1.5 text-[11px] font-black text-indigo-600 border border-indigo-100 uppercase tracking-widest">
                        The Spatial Engine v2.0
                      </div>
                      <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight leading-[1.1]">Deterministic <br /> Coordinate Extraction.</h2>
                      <p className="text-gray-500 font-medium text-lg md:text-xl leading-relaxed">
                        Generic AI parsers guess. We calculate. By mapping every character to its precise XYZ coordinate, we reconstruct tables with surgical precision across any language.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                          <Languages className="h-6 w-6" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900">Multilingual Native</h4>
                        <p className="text-sm text-gray-500 font-medium">Automatic script detection for 100+ languages without translation.</p>
                      </div>
                      <div className="space-y-4">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                          <Layout className="h-6 w-6" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900">Structure Locked</h4>
                        <p className="text-sm text-gray-500 font-medium">Row sequence and column alignment are preserved visually.</p>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-5 bg-gray-900 p-8 md:p-16 flex flex-col justify-center relative border-l border-gray-800">
                    <div className="space-y-6 font-mono text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-rose-500" />
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      </div>
                      <div className="text-emerald-400">$ docc --universal --fidelity-mode</div>
                      <div className="text-gray-500">{"{"}</div>
                      <div className="pl-4 text-indigo-300">"input_language": "Detected: Hindi + Arabic",</div>
                      <div className="pl-4 text-indigo-300">"extraction_mode": "Spatial_Coordinate",</div>
                      <div className="pl-4 text-indigo-300">"unicode_fidelity": "99.99%",</div>
                      <div className="pl-4 text-emerald-400">"preserve_rows": true,</div>
                      <div className="text-gray-500">{"}"}</div>
                      <div className="mt-8 bg-indigo-600/10 border border-indigo-500/20 p-4 rounded-xl">
                        <div className="text-xs text-indigo-300 mb-2 uppercase font-black">Live Data Stream</div>
                        <div className="text-white">राम कुमार | رامي كومار | 45</div>
                        <div className="text-white">सीता देवी | سيتا ديفي | 42</div>
                      </div>
                    </div>
                    {/* Decorative pointer */}
                    <div className="absolute top-1/4 right-1/4 animate-bounce">
                      <MousePointer2 className="h-8 w-8 text-indigo-400 drop-shadow-2xl" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-40 bg-white relative">
          <div className="container px-6 mx-auto">
            <div className="max-w-3xl mb-24">
              <h2 className="text-5xl md:text-7xl font-black text-gray-900 mb-8 leading-[0.95]">Built for High-Stakes <br /> Digitization.</h2>
              <p className="text-gray-500 font-medium text-xl">
                When "close enough" isn't an option. We deliver the exact data as it exists in your documents.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
              <FeatureCard 
                icon={<Globe className="h-10 w-10 text-indigo-600" />}
                title="Universal Script Support"
                description="From Devanagari to Kanji, Arabic to Latin—our engine treats every character as a first-class citizen."
              />
              <FeatureCard 
                icon={<Shield className="h-10 w-10 text-emerald-600" />}
                title="Zero-Hallucination"
                description="We never guess or rewrite. If the OCR is uncertain, we flag it for your review. Integrity first."
              />
              <FeatureCard 
                icon={<Layers className="h-10 w-10 text-amber-600" />}
                title="Interactive Review"
                description="A powerful spreadsheet-like editor to merge, split, and verify records before the final export."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-40">
          <div className="container px-6 mx-auto">
            <div className="bg-indigo-600 rounded-[4rem] p-16 md:p-32 text-center relative overflow-hidden shadow-2xl shadow-indigo-200">
              <div className="absolute top-0 right-0 w-[50%] h-full bg-white/5 skew-x-[-20deg] translate-x-[20%]" />
              <div className="relative z-10 max-w-4xl mx-auto">
                <h2 className="text-5xl md:text-8xl font-black text-white mb-10 leading-[0.85] tracking-tighter">Digitize without <br /> Compromise.</h2>
                <p className="text-indigo-100 text-xl md:text-2xl mb-16 font-medium leading-relaxed">
                  Join the thousands of data professionals using Docc to turn complex PDF records into clean, structured Excel data.
                </p>
                <Link href="/register">
                  <Button size="lg" className="h-20 px-16 bg-white text-indigo-600 hover:bg-gray-50 font-black text-2xl rounded-[2rem] shadow-2xl transition-all hover:scale-105 active:scale-95">
                    Start Now — First 100 Pages Free
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-24 border-t border-gray-100 bg-white">
        <div className="container px-6 mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-16">
            <div className="space-y-8 max-w-md">
              <Link className="flex items-center group" href="/">
                <div className="relative h-10 w-10 overflow-hidden rounded-xl">
                  <Image 
                    src="/logo.png" 
                    alt="Docc Logo" 
                    fill 
                    sizes="40px"
                    className="object-cover scale-150"
                  />
                </div>
                <span className="ml-3 text-2xl font-black tracking-tight text-gray-900">Docc</span>
              </Link>
              <p className="text-gray-500 font-medium text-lg leading-relaxed">
                The leading edge of spatial document digitization. Preserving the world's documents one coordinate at a time.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-16 md:gap-32">
              <div>
                <h4 className="font-black text-gray-900 mb-8 text-xs uppercase tracking-[0.2em]">Technology</h4>
                <ul className="space-y-5 text-sm font-bold text-gray-400">
                  <li><Link href="#" className="hover:text-indigo-600 transition-colors">Spatial Engine</Link></li>
                  <li><Link href="#" className="hover:text-indigo-600 transition-colors">OCR Pipelines</Link></li>
                  <li><Link href="#" className="hover:text-indigo-600 transition-colors">Security</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-black text-gray-900 mb-8 text-xs uppercase tracking-[0.2em]">Platform</h4>
                <ul className="space-y-5 text-sm font-bold text-gray-400">
                  <li><Link href="#" className="hover:text-indigo-600 transition-colors">Dashboard</Link></li>
                  <li><Link href="#" className="hover:text-indigo-600 transition-colors">Pricing</Link></li>
                  <li><Link href="#" className="hover:text-indigo-600 transition-colors">API Docs</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-32 pt-10 border-t border-gray-50 flex flex-col sm:flex-row justify-between gap-8 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">
            <div>© 2024 Docc — Universal Digitization Systems</div>
            <div className="flex gap-10">
              <Link href="#" className="hover:text-indigo-600">Privacy</Link>
              <Link href="#" className="hover:text-indigo-600">Terms</Link>
              <Link href="#" className="hover:text-indigo-600">Twitter</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group relative space-y-8">
      <div className="bg-white p-6 rounded-3xl shadow-2xl shadow-gray-100 border border-gray-50 w-fit group-hover:scale-110 transition-transform duration-500">
        {icon}
      </div>
      <div className="space-y-4">
        <h3 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h3>
        <p className="text-gray-500 font-medium text-lg leading-relaxed">{description}</p>
      </div>
      <Link href="#" className="inline-flex items-center text-indigo-600 font-black text-xs uppercase tracking-[0.2em] group-hover:gap-2 transition-all">
        Deep Dive
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
