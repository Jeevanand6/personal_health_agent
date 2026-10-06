import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/lib/auth-context";
import { LanguageProvider } from "@/lib/language-context";
import DemoModeBanner, { DemoModeProvider } from "@/components/DemoModeBanner";

export const metadata: Metadata = {
  title: "HealthCopilot - AI-Powered Personal Health Record Assistant",
  description:
    "Intelligently extract, organize, explain, and track personal medical records, lab reports, and prescriptions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-slate-50 antialiased font-sans">
        <LanguageProvider>
          <AuthProvider>
            <DemoModeProvider>
              <DemoModeBanner />
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </DemoModeProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
