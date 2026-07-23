"use client";

import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Star,
  Award,
  ArrowRight,
} from "lucide-react";
import type { AgentProfile } from "@/lib/db/schema";

export type TemplateProps = {
  profile: AgentProfile;
  preview?: boolean;
};

/**
 * Elegant Template — glassmorphism, soft gradients, frosted cards, premium feel.
 * Inspired by: Apple, Notion, Arc Browser design language.
 */
export default function ElegantTemplate({
  profile,
  preview = false,
}: TemplateProps) {
  const vis = profile.visibilitySettings ?? {
    showPhone: true,
    showEmail: true,
    showTransactions: true,
    showAwards: true,
    showTestimonials: true,
    showAddress: true,
  };

  const serviceAreas = (profile.serviceAreas ?? []) as string[];
  const specialties = (profile.specialties ?? []) as string[];
  const transactions = (profile.transactions ?? []) as Array<{
    address: string;
    city: string;
    price: string;
    type: string;
  }>;
  const testimonials = (profile.testimonials ?? []) as Array<{
    name: string;
    text: string;
    rating: number;
  }>;
  const awards = (profile.awards ?? []) as string[];
  const languages = (profile.languages ?? []) as string[];
  const firstName = profile.name.split(" ")[0];

  const showTransactions = vis.showTransactions && transactions.length > 0;
  const showTestimonials = vis.showTestimonials && testimonials.length > 0;
  const showAwards = vis.showAwards && awards.length > 0;

  return (
    <div
      className="min-h-screen font-sans"
      style={{
        background:
          "linear-gradient(135deg, #fef9f0 0%, #f0f4ff 30%, #fdf2f8 60%, #f0fdf4 100%)",
      }}
    >
      {/* ── Floating Nav ── */}
      <header className="sticky top-0 z-50 px-4 pt-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border border-gray-200/60 bg-white/70 px-5 py-3 shadow-lg shadow-gray-200/20 backdrop-blur-xl">
          <span className="text-sm font-bold tracking-tight text-gray-900">
            {firstName}
            <span className="font-normal text-gray-400">
              {" "}
              · {profile.title || "Agent"}
            </span>
          </span>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-5 text-sm text-gray-500 md:flex">
            <a
              href="#about"
              className="transition-colors hover:text-gray-900"
            >
              About
            </a>
            {showTransactions && (
              <a
                href="#transactions"
                className="transition-colors hover:text-gray-900"
              >
                Work
              </a>
            )}
            {showTestimonials && (
              <a
                href="#testimonials"
                className="transition-colors hover:text-gray-900"
              >
                Reviews
              </a>
            )}
            <a
              href="#contact"
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Contact <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </nav>

          {/* Mobile CTA */}
          <a
            href="#contact"
            className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-medium text-white md:hidden"
          >
            Contact
          </a>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-12 md:pb-24 md:pt-20">
        <div className="flex flex-col items-center gap-8 md:flex-row md:gap-16">
          {/* Circular photo with decorative accents */}
          <div className="relative flex-shrink-0">
            <div className="h-40 w-40 overflow-hidden rounded-3xl shadow-2xl shadow-purple-200/40 ring-1 ring-black/5 md:h-56 md:w-56">
              <img
                src={
                  profile.photoUrl ||
                  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&h=500&fit=crop&crop=faces"
                }
                alt={profile.name}
                className="h-full w-full object-cover"
              />
            </div>
            {/* Decorative dots */}
            <div className="absolute -bottom-3 -right-3 h-8 w-8 rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 opacity-60" />
            <div className="absolute -left-2 -top-2 h-5 w-5 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-400 opacity-40" />
          </div>

          {/* Text block */}
          <div className="flex-1 text-center md:text-left">
            <p className="mb-2 text-sm font-medium text-purple-600/80">
              {profile.brokerage || "Real Estate Professional"}
            </p>
            <h1 className="mb-4 text-4xl font-bold leading-[1.1] tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
              {profile.name}
            </h1>
            <p className="mb-6 max-w-lg text-lg leading-relaxed text-gray-500">
              {profile.bio?.slice(0, 180) ||
                `${profile.title || "Agent"} helping you navigate real estate with care and expertise.`}
            </p>

            {serviceAreas.length > 0 && (
              <div className="mb-6 flex items-center justify-center gap-1.5 text-sm text-gray-400 md:justify-start">
                <MapPin className="h-3.5 w-3.5" />
                {serviceAreas.slice(0, 3).join(" · ")}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3 md:justify-start">
              {vis.showPhone && profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-900/10 transition-all hover:bg-gray-800"
                >
                  <Phone className="h-4 w-4" /> {profile.phone}
                </a>
              )}
              {vis.showEmail && profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition-all hover:bg-white"
                >
                  <Mail className="h-4 w-4" /> Email
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats — frosted cards ── */}
      {(profile.yearsExperience || transactions.length > 0) && (
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {!!profile.yearsExperience && (
              <div className="rounded-2xl border border-white/80 bg-white/60 p-5 text-center shadow-sm backdrop-blur-sm">
                <p className="text-3xl font-bold text-gray-900">
                  {profile.yearsExperience}+
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Years Experience
                </p>
              </div>
            )}
            {transactions.length > 0 && (
              <div className="rounded-2xl border border-white/80 bg-white/60 p-5 text-center shadow-sm backdrop-blur-sm">
                <p className="text-3xl font-bold text-gray-900">
                  {transactions.length}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Deals Done
                </p>
              </div>
            )}
            {serviceAreas.length > 0 && (
              <div className="rounded-2xl border border-white/80 bg-white/60 p-5 text-center shadow-sm backdrop-blur-sm">
                <p className="text-3xl font-bold text-gray-900">
                  {serviceAreas.length}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Service Areas
                </p>
              </div>
            )}
            {testimonials.length > 0 && (
              <div className="rounded-2xl border border-white/80 bg-white/60 p-5 text-center shadow-sm backdrop-blur-sm">
                <p className="text-3xl font-bold text-gray-900">
                  {testimonials.length}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Reviews
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── About — full bio ── */}
      <section id="about" className="mx-auto max-w-3xl px-4 pb-20">
        <div className="rounded-3xl border border-white/80 bg-white/70 p-8 shadow-sm backdrop-blur-sm md:p-12">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            About {firstName}
          </h2>
          <p className="whitespace-pre-line text-lg leading-relaxed text-gray-600">
            {profile.bio ||
              `${profile.name} is a dedicated real estate professional committed to excellence.`}
          </p>

          {specialties.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Specialties
              </h3>
              <div className="flex flex-wrap gap-2">
                {specialties.map((s) => (
                  <span
                    key={s}
                    className="rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-pink-50 px-3.5 py-1.5 text-sm font-medium text-purple-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {languages.length > 1 && (
            <div className="mt-8">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Languages
              </h3>
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <span
                    key={l}
                    className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-3.5 py-1.5 text-sm font-medium text-blue-700"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {showAwards && (
            <div className="mt-8">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Awards
              </h3>
              <div className="space-y-2">
                {awards.map((a) => (
                  <div
                    key={a}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    <Award className="h-4 w-4 flex-shrink-0 text-amber-500" />{" "}
                    {a}
                  </div>
                ))}
              </div>
            </div>
          )}

          {vis.showAddress && profile.officeAddress && (
            <div className="mt-8">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Office
              </h3>
              <p className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
                {profile.officeAddress}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Transactions ── */}
      {showTransactions && (
        <section id="transactions" className="mx-auto max-w-5xl px-4 pb-20">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Recent Transactions
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {transactions.slice(0, 8).map((tx, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {tx.address}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {tx.city} · {tx.type || "Closed"}
                  </p>
                </div>
                <p className="font-bold text-gray-900">{tx.price}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Testimonials ── */}
      {showTestimonials && (
        <section id="testimonials" className="mx-auto max-w-4xl px-4 pb-20">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            What Clients Say
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {testimonials.slice(0, 4).map((t, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm"
              >
                <div className="mb-3 flex gap-0.5">
                  {[...Array(t.rating || 5)].map((_, j) => (
                    <Star
                      key={j}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="text-sm italic leading-relaxed text-gray-600">
                  &ldquo;{t.text}&rdquo;
                </p>
                <p className="mt-4 text-sm font-bold text-gray-900">
                  &mdash; {t.name}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Contact CTA ── */}
      <section id="contact" className="mx-auto max-w-xl px-4 pb-20">
        <div className="rounded-3xl border border-white/80 bg-white/70 p-8 text-center shadow-sm backdrop-blur-sm md:p-12">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            Let&apos;s Connect
          </h2>
          <p className="mb-8 text-gray-500">
            Ready to buy or sell? Reach out to {firstName} today.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {vis.showPhone && profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-900/10 transition-all hover:bg-gray-800"
              >
                <Phone className="h-4 w-4" /> Call {firstName}
              </a>
            )}
            {vis.showEmail && profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition-all hover:bg-white"
              >
                <Mail className="h-4 w-4" /> Email {firstName}
              </a>
            )}
          </div>

          {/* Seller consultation CTA */}
          <div className="mt-6">
            <Link
              href={profile.bookingUrl || `mailto:${profile.email}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 transition-colors hover:text-purple-800"
            >
              Discuss Your Selling Goals <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {profile.bookingUrl && (
            <div className="mt-4">
              <a
                href={profile.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
              >
                Book a Meeting <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 text-center text-xs text-gray-400">
        <p>
          &copy; {new Date().getFullYear()}{" "}
          {profile.brokerage || "Kevv AI Inc."} &middot; All Rights Reserved
        </p>
        <p className="mt-2 text-gray-300">Powered by Kevv AI</p>
      </footer>
    </div>
  );
}
