import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/lib/auth-context";
import { LanguageProvider } from "@/lib/language-context";
import { DemoModeProvider } from "@/components/DemoModeBanner";

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
      <body className="min-h-screen bg-slate-50 antialiased font-sans">
        <LanguageProvider>
          <AuthProvider>
            <DemoModeProvider>
              <AppShell>{children}</AppShell>
            </DemoModeProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
