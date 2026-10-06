"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Activity,
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function RegisterPage() {
  const { language, setLanguage, isTamil, t } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState(language);
  const [bloodGroup, setBloodGroup] = useState("");
  const [gender, setGender] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  const handleLanguageSelect = (lang: string) => {
    if (lang === "en" || lang === "ta") {
      setPreferredLanguage(lang);
      setLanguage(lang);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(
        isTamil
          ? "கடவுச்சொல் குறைந்தது 8 எழுத்துக்கள் இருக்க வேண்டும்."
          : "Password must be at least 8 characters long."
      );
      return;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      setError(
        isTamil
          ? "கடவுச்சொல் பெரியெழுத்து, சிறியெழுத்து, எண் மற்றும் சிறப்புக் குறியீட்டைக் கொண்டிருக்க வேண்டும் (எ.கா. Password123!)."
          : "Password must include uppercase, lowercase, number, and special character (e.g. Password123!)."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        isTamil
          ? "கடவுச்சொற்கள் பொருந்தவில்லை. மீண்டும் உள்ளிடவும்."
          : "Passwords do not match. Please re-enter."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email,
        password,
        full_name: fullName,
        preferred_language: preferredLanguage,
        blood_group: bloodGroup || undefined,
        gender: gender || undefined,
        contact_number: contactNumber || undefined,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : isTamil
          ? "பதிவு செய்தல் தோல்வியடைந்தது."
          : "Registration failed.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8 bg-white p-8 sm:p-10 rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/40">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/80 items-center justify-center text-teal-600 shadow-inner mb-1">
            <Activity className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t("auth", "register_title", "Create Your Health Profile")}
          </h2>
          <p className="text-xs text-slate-500">
            {t("auth", "register_subtitle", "Join the personalized clinical AI copilot for secure record tracking")}
          </p>
        </div>

        {/* Mock ABHA Badge Notification */}
        <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 flex items-start gap-3 text-xs text-teal-900">
          <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-teal-950 font-semibold">
              {isTamil ? "ABDM மாதிரி கட்டமைப்பு: " : "ABDM Mock Architecture: "}
            </strong>
            {isTamil
              ? "உங்கள் சுயவிவரத்திற்காக தனிப்பட்ட 14-இலக்க மாதிரி ABHA எண் மற்றும் ABHA முகவரி தானாக உருவாக்கப்படும்."
              : "A unique illustrative 14-digit ABHA ID and ABHA address will be provisioned automatically for your profile."}
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              {t("auth", "fullname_label", "Full Legal Name")} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isTamil ? "உதா. அருண் குமார்" : "e.g. Arun Kumar"}
                className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              {t("auth", "email_label", "Email Address")} <span className="text-rose-500">*</span>
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
                className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {t("auth", "password_label", "Password")} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isTamil ? "குறைந்தது 8 எழுத்துகள்" : "Min. 8 characters"}
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {isTamil ? "கடவுச்சொல்லை உறுதிப்படுத்தவும்" : "Confirm Password"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={isTamil ? "மீண்டும் உள்ளிடவும்" : "Repeat password"}
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {t("auth", "language_label", "Preferred Language")}
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => handleLanguageSelect(e.target.value)}
                className="block w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 bg-white text-slate-900"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {t("auth", "blood_group_label", "Blood Group")}
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="block w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 bg-white text-slate-900"
              >
                <option value="">{isTamil ? "தேர்ந்தெடு" : "Select"}</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {t("auth", "gender_label", "Gender")}
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="block w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 bg-white text-slate-900"
              >
                <option value="">{isTamil ? "தேர்ந்தெடு" : "Select"}</option>
                <option value="male">{isTamil ? "ஆண்" : "Male"}</option>
                <option value="female">{isTamil ? "பெண்" : "Female"}</option>
                <option value="other">{isTamil ? "மற்றவை" : "Other"}</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-600 shadow-md shadow-teal-600/25 transition-all disabled:opacity-50 mt-2"
          >
            {isSubmitting ? (
              <span>{isTamil ? "கணக்கு உருவாக்கப்படுகிறது..." : "Creating Patient Account..."}</span>
            ) : (
              <>
                <span>{t("auth", "submit_register", "Register & Continue")}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center space-y-3 text-xs border-t border-slate-100">
          <p className="text-slate-500">
            {t("auth", "have_account", "Already registered?")}{" "}
            <Link
              href="/login"
              className="font-semibold text-teal-600 hover:text-teal-700 hover:underline"
            >
              {isTamil ? "உள்நுழைக" : "Sign in to record"}
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>
              {isTamil
                ? "Argon2id & HIPAA இணக்கமான தரவு பாதுகாப்புடன் குறியாக்கம் செய்யப்பட்டது"
                : "Encrypted with Argon2id & HIPAA-aligned Data Protection"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

