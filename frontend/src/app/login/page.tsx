"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Activity, Lock, Mail, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, user, isLoading } = useAuth();
  const { isTamil, t } = useLanguage();
  const router = useRouter();

  // If already authenticated, redirect directly to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError(
        isTamil
          ? "மின்னஞ்சல் மற்றும் கடவுச்சொல் இரண்டையும் உள்ளிடவும்."
          : "Please enter both email and password."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : isTamil
          ? "தவறான மின்னஞ்சல் அல்லது கடவுச்சொல்."
          : "Invalid email or password.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/40">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/80 items-center justify-center text-teal-600 shadow-inner mb-1">
            <Activity className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t("auth", "login_title", "Sign in to your Health Record")}
          </h2>
          <p className="text-xs text-slate-500">
            {t("auth", "login_subtitle", "Access your encrypted clinical timeline and lab analyses")}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              {t("auth", "email_label", "Email Address")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition-colors bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                {t("auth", "password_label", "Password")}
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition-colors bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-600 shadow-md shadow-teal-600/25 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>{isTamil ? "சரிபார்க்கிறது..." : "Authenticating..."}</span>
            ) : (
              <>
                <span>{t("auth", "submit_login", "Sign In")}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="pt-2 text-center space-y-4 text-xs border-t border-slate-100">
          <p className="text-slate-500">
            {t("auth", "no_account", "Don't have an account?")}{" "}
            <Link
              href="/register"
              className="font-semibold text-teal-600 hover:text-teal-700 hover:underline"
            >
              {isTamil ? "புதிய கணக்கை உருவாக்கவும்" : "Create patient profile"}
            </Link>
          </p>

          <button
            type="button"
            onClick={() => {
              setEmail("demo@example.com");
              setPassword("Password123!");
            }}
            className="text-[11px] text-teal-800 bg-teal-50 hover:bg-teal-100 py-1.5 px-3 rounded-lg border border-teal-200/80 font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Fill Demo Credentials: demo@example.com</span>
          </button>

          <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>
              {isTamil
                ? "Argon2id மற்றும் JWT குறியாக்கம் மூலம் பாதுகாக்கப்படுகிறது"
                : "Encrypted with Argon2id & JWT Authentication"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

