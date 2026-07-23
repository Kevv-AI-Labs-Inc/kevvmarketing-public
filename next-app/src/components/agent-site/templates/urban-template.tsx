"use client";

import Link from "next/link";
import type { AgentProfile } from "@/lib/db/schema";

export type TemplateProps = {
  profile: AgentProfile;
  preview?: boolean;
};

/**
 * Urban Template — dark mode, neon accents, cyberpunk aesthetic.
 * Faithful port of the reference UrbanTemplate from realtor-profile-pages.
 */
export function UrbanTemplate({ profile, preview = false }: TemplateProps) {
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

  const showTransactions = vis.showTransactions !== false && transactions.length > 0;
  const showTestimonials = vis.showTestimonials !== false && testimonials.length > 0;
  const showAwards = vis.showAwards !== false && awards.length > 0;

  return (
    <div className="min-h-screen bg-[#0c0c14] text-white font-sans overflow-x-hidden">
      {/* ── Fixed background glow effects ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-fuchsia-500/[0.08] rounded-full blur-[100px]" />
      </div>

      {/* ── Nav ── */}
      <header className="relative z-20 px-6 py-5 flex justify-between items-center max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="block w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-sm font-bold tracking-wider uppercase">
            {firstName}
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-xs tracking-widest uppercase text-gray-500">
          <a href="#about" className="hover:text-cyan-400 transition-colors">
            About
          </a>
          {showTransactions && (
            <a href="#transactions" className="hover:text-cyan-400 transition-colors">
              Deals
            </a>
          )}
          {showTestimonials && (
            <a href="#testimonials" className="hover:text-cyan-400 transition-colors">
              Reviews
            </a>
          )}
          <a
            href="#contact"
            className="bg-cyan-500 text-black px-4 py-1.5 rounded-sm font-bold hover:bg-cyan-400 transition-colors"
          >
            Contact
          </a>
        </nav>
        <a
          href="#contact"
          className="md:hidden bg-cyan-500 text-black px-4 py-1.5 rounded-sm text-xs font-bold"
        >
          Contact
        </a>
      </header>

      {/* ── Hero (2-col: text + photo) ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 md:pt-20 pb-20 md:pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
          {/* Text column */}
          <div>
            {/* Animated pulse indicator + title */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs tracking-widest uppercase text-cyan-400/80 font-medium">
                {profile.title || "Real Estate Agent"}
              </span>
            </div>

            {/* Gradient text name */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-6">
              {profile.name.split(" ").map((word, i) => (
                <span
                  key={i}
                  className={`block ${
                    i > 0
                      ? "text-transparent bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text"
                      : ""
                  }`}
                >
                  {word}
                </span>
              ))}
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed mb-6 max-w-md">
              {profile.bio?.slice(0, 150) ||
                "Bringing energy and expertise to every deal."}
            </p>

            {serviceAreas.length > 0 && (
              <p className="text-xs text-gray-600 tracking-wider uppercase mb-8 flex items-center gap-1.5">
                {/* MapPin inline SVG */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {serviceAreas.slice(0, 3).join(" · ")}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {vis.showPhone !== false && profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="group inline-flex items-center gap-2 bg-cyan-500 text-black px-6 py-3 rounded-sm font-bold text-sm hover:bg-cyan-400 transition-all"
                >
                  {/* Phone SVG */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Call
                  {/* ArrowUpRight */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="7" y1="17" x2="17" y2="7" />
                    <polyline points="7 7 17 7 17 17" />
                  </svg>
                </a>
              )}
              <a
                href="#contact"
                className="inline-flex items-center gap-2 border border-gray-700 hover:border-cyan-500/50 px-6 py-3 rounded-sm font-bold text-sm text-gray-300 hover:text-cyan-400 transition-all"
              >
                {/* Mail SVG */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                Message
              </a>
            </div>
          </div>

          {/* Photo column with stats overlay */}
          <div className="relative">
            <div className="aspect-[3/4] rounded-sm overflow-hidden border border-gray-800">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "50% 20%" }}
                />
              ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center text-gray-700 text-6xl font-black">
                  {firstName[0]}
                </div>
              )}
              {/* Neon border overlay */}
              <div className="absolute inset-0 border border-cyan-400/20 rounded-sm pointer-events-none" />
              {/* Gradient fade at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#0c0c14] to-transparent" />
            </div>

            {/* Stats overlay on photo */}
            <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2">
              {profile.yearsExperience != null && profile.yearsExperience > 0 && (
                <div className="bg-black/70 backdrop-blur-sm border border-gray-800 rounded-sm p-3 text-center">
                  <p className="text-lg font-black text-cyan-400">
                    {profile.yearsExperience}+
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Years
                  </p>
                </div>
              )}
              {transactions.length > 0 && (
                <div className="bg-black/70 backdrop-blur-sm border border-gray-800 rounded-sm p-3 text-center">
                  <p className="text-lg font-black text-fuchsia-400">
                    {transactions.length}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Deals
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section
        id="about"
        className="relative z-10 border-t border-gray-800/50 py-20 md:py-28"
      >
        <div className="max-w-4xl mx-auto px-6">
          {/* Colored section divider line */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-px bg-cyan-500" />
            <span className="text-xs tracking-widest uppercase text-cyan-400/80 font-medium">
              About
            </span>
          </div>

          <p className="text-gray-400 text-lg leading-relaxed whitespace-pre-line max-w-2xl">
            {profile.bio ||
              `${profile.name} delivers results with intensity and precision in every market.`}
          </p>

          {/* Brokerage */}
          {profile.brokerage && (
            <p className="mt-6 text-sm text-gray-600">
              {profile.brokerage}
            </p>
          )}

          {/* Office Address */}
          {vis.showAddress !== false && profile.officeAddress && (
            <p className="mt-2 text-sm text-gray-600 flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {profile.officeAddress}
            </p>
          )}

          {/* Languages */}
          {languages.length > 0 && (
            <p className="mt-4 text-xs text-gray-600 tracking-wider uppercase">
              Languages: {languages.join(" · ")}
            </p>
          )}

          {/* Specialties tags */}
          {specialties.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="px-4 py-2 rounded-sm border border-gray-800 text-gray-400 text-sm font-medium hover:border-cyan-500/40 hover:text-cyan-400 transition-colors cursor-default"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Awards */}
          {showAwards && (
            <div className="mt-8 space-y-2">
              {awards.map((a) => (
                <div
                  key={a}
                  className="flex items-center gap-2 text-gray-500 text-sm"
                >
                  {/* Award SVG */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-fuchsia-400/60 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="6" />
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                  </svg>
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Transactions (3-col grid) ── */}
      {showTransactions && (
        <section
          id="transactions"
          className="relative z-10 border-t border-gray-800/50 py-20 md:py-28"
        >
          <div className="max-w-5xl mx-auto px-6">
            {/* Fuchsia divider */}
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-px bg-fuchsia-500" />
              <span className="text-xs tracking-widest uppercase text-fuchsia-400/80 font-medium">
                Deal Flow
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {transactions.slice(0, 9).map((tx, i) => (
                <div
                  key={i}
                  className="bg-white/[0.02] border border-gray-800 rounded-sm p-4 hover:border-cyan-500/30 transition-all group"
                >
                  <p className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors">
                    {tx.address}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{tx.city}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/50">
                    <span className="text-sm font-black text-cyan-400">
                      {tx.price}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 px-2 py-0.5 border border-gray-800 rounded-sm">
                      {tx.type || "Closed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Testimonials ── */}
      {showTestimonials && (
        <section
          id="testimonials"
          className="relative z-10 border-t border-gray-800/50 py-20 md:py-28"
        >
          <div className="max-w-4xl mx-auto px-6">
            {/* Yellow divider */}
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-px bg-yellow-500" />
              <span className="text-xs tracking-widest uppercase text-yellow-400/80 font-medium">
                Social Proof
              </span>
            </div>
            <div className="space-y-4">
              {testimonials.slice(0, 4).map((t, i) => (
                <div
                  key={i}
                  className="bg-white/[0.02] border border-gray-800 rounded-sm p-6 hover:border-fuchsia-500/20 transition-all"
                >
                  {/* Star rating */}
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(t.rating || 5)].map((_, j) => (
                      <svg
                        key={j}
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-gray-400 italic leading-relaxed">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <p className="mt-3 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    &mdash; {t.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Contact CTA ── */}
      <section
        id="contact"
        className="relative z-10 border-t border-gray-800/50 py-20 md:py-28"
      >
        <div className="max-w-xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-px bg-cyan-500" />
            <span className="text-xs tracking-widest uppercase text-cyan-400/80 font-medium">
              Get in Touch
            </span>
            <div className="w-8 h-px bg-cyan-500" />
          </div>

          <h2 className="text-3xl md:text-4xl font-black mb-4">
            Let&apos;s make your next move{" "}
            <span className="text-transparent bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text">
              legendary
            </span>
          </h2>

          <p className="text-gray-500 mb-8 text-sm">
            Ready to buy, sell, or just explore the market? Reach out and
            let&apos;s connect.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {vis.showPhone !== false && profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="inline-flex items-center gap-2 bg-cyan-500 text-black px-8 py-3 rounded-sm font-bold text-sm hover:bg-cyan-400 transition-all w-full sm:w-auto justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {profile.phone}
              </a>
            )}

            {vis.showEmail !== false && profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="inline-flex items-center gap-2 border border-gray-700 hover:border-cyan-500/50 px-8 py-3 rounded-sm font-bold text-sm text-gray-300 hover:text-cyan-400 transition-all w-full sm:w-auto justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                Email
              </a>
            )}

            {profile.bookingUrl && (
              <a
                href={profile.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-fuchsia-800 hover:border-fuchsia-500/50 px-8 py-3 rounded-sm font-bold text-sm text-gray-300 hover:text-fuchsia-400 transition-all w-full sm:w-auto justify-center"
              >
                Book a Call
              </a>
            )}
          </div>

          {/* Seller consultation CTA */}
          <div className="mt-8">
            <Link
              href={profile.bookingUrl || `mailto:${profile.email}`}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-cyan-400 transition-colors group"
            >
              Discuss your selling goals
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-gray-800/50 text-center py-8 text-xs text-gray-700">
        <p>
          &copy; {new Date().getFullYear()}{" "}
          {profile.brokerage || "Kevv AI Inc."} &middot; All Rights Reserved
        </p>
        <p className="mt-2 text-gray-800">Powered by Kevv AI</p>
      </footer>
    </div>
  );
}
