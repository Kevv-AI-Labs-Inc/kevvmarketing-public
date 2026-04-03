"use client";

import Link from "next/link";
import type { AgentProfile } from "@/lib/db/schema";

export type TemplateProps = {
  profile: AgentProfile;
  preview?: boolean;
};

/**
 * Modern Template — bright, full-width hero image, clean typography, card-based layout.
 * Target: new-generation agents who want a fresh, approachable look.
 */
export default function ModernTemplate({ profile, preview = false }: TemplateProps) {
  const serviceAreas = (profile.serviceAreas ?? []) as string[];
  const specialties = (profile.specialties ?? []) as string[];
  const languages = (profile.languages ?? []) as string[];
  const awards = (profile.awards ?? []) as string[];
  const testimonials = (profile.testimonials ?? []) as Array<{
    name: string;
    text: string;
    rating: number;
  }>;
  const transactions = (profile.transactions ?? []) as Array<{
    address: string;
    city: string;
    price: string;
    type: string;
  }>;
  const visibility = profile.visibilitySettings ?? {
    showPhone: true,
    showEmail: true,
    showTransactions: true,
    showAwards: true,
    showTestimonials: true,
    showAddress: true,
  };

  const firstName = profile.name.split(" ")[0];

  /* ------------------------------------------------------------------ */
  /*  Star helper                                                        */
  /* ------------------------------------------------------------------ */
  function StarIcon({ filled }: { filled: boolean }) {
    return (
      <svg
        className={`h-4 w-4 ${filled ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ============================================================= */}
      {/*  Hero — Full-width image with text overlay                     */}
      {/* ============================================================= */}
      <section className="relative h-[70vh] md:h-[80vh] overflow-hidden">
        {/* Background image: prefer heroImageUrl, fallback to photoUrl, then placeholder */}
        <img
          src={
            profile.heroImageUrl ||
            profile.photoUrl ||
            "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1400&h=900&fit=crop&crop=faces"
          }
          alt={profile.name}
          className="w-full h-full object-cover"
          style={{ objectPosition: "50% 25%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Agent photo overlay (circular) when heroImageUrl is used */}
        {profile.heroImageUrl && profile.photoUrl && (
          <div className="absolute bottom-32 md:bottom-36 left-8 md:left-12 lg:left-16">
            <img
              src={profile.photoUrl}
              alt={profile.name}
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg object-cover"
            />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 lg:p-16">
          <div className="max-w-4xl">
            <p className="text-blue-300 text-sm font-semibold tracking-wider uppercase mb-2">
              {profile.title || "Real Estate Agent"}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-3 leading-tight">
              {profile.name}
            </h1>
            <p className="text-gray-300 text-lg">
              {profile.brokerage && <span>{profile.brokerage} &middot; </span>}
              {serviceAreas.length > 0 && serviceAreas.slice(0, 3).join(", ")}
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              {visibility.showPhone && profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
                >
                  {/* Phone icon */}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Call {firstName}
                </a>
              )}
              {visibility.showEmail && profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors border border-white/30"
                >
                  {/* Mail icon */}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  Send Message
                </a>
              )}
              {profile.bookingUrl && (
                <a
                  href={profile.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors border border-white/30"
                >
                  {/* Calendar icon */}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Book a Meeting
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/*  Stats Bar                                                     */}
      {/* ============================================================= */}
      <section className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap justify-center gap-8 md:gap-16">
          {profile.yearsExperience != null && profile.yearsExperience > 0 && (
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{profile.yearsExperience}+</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Years Experience</p>
            </div>
          )}
          {visibility.showTransactions && transactions.length > 0 && (
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{transactions.length}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Transactions</p>
            </div>
          )}
          {serviceAreas.length > 0 && (
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{serviceAreas.length}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Areas Served</p>
            </div>
          )}
          {specialties.length > 0 && (
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{specialties.length}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Specialties</p>
            </div>
          )}
          {languages.length > 1 && (
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{languages.length}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Languages</p>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================= */}
      {/*  About                                                         */}
      {/* ============================================================= */}
      <section id="about" className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-6">About {firstName}</h2>
        <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-line">
          {profile.bio ||
            `${profile.name} is a dedicated real estate professional committed to helping clients buy and sell with confidence.`}
        </p>

        {visibility.showAddress && profile.officeAddress && (
          <div className="mt-8 flex items-start gap-2 text-gray-600">
            {/* MapPin icon */}
            <svg className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{profile.officeAddress}</span>
          </div>
        )}

        {specialties.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Specialties
            </h3>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {languages.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Languages
            </h3>
            <div className="flex flex-wrap gap-2">
              {languages.map((l) => (
                <span
                  key={l}
                  className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============================================================= */}
      {/*  Awards                                                        */}
      {/* ============================================================= */}
      {visibility.showAwards && awards.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-2xl font-bold mb-8 text-center">Awards &amp; Recognition</h2>
            <div className="space-y-3">
              {awards.map((a) => (
                <div
                  key={a}
                  className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                >
                  {/* Award icon */}
                  <svg className="h-5 w-5 text-yellow-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6" />
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                  </svg>
                  <span className="text-gray-700 font-medium">{a}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================= */}
      {/*  Transactions                                                  */}
      {/* ============================================================= */}
      {visibility.showTransactions && transactions.length > 0 && (
        <section id="transactions" className={`${visibility.showAwards && awards.length > 0 ? "bg-white" : "bg-gray-50"} py-16`}>
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-bold mb-8 text-center">Recent Transactions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {transactions.slice(0, 6).map((tx, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <p className="font-semibold text-gray-900 mb-1">{tx.address}</p>
                  {tx.city && (
                    <p className="text-sm text-gray-500 mb-1">{tx.city}</p>
                  )}
                  <p className="text-blue-600 font-bold text-lg">{tx.price}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.type === "Sold"
                          ? "bg-green-50 text-green-700"
                          : tx.type === "Listed"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {tx.type || "Closed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================= */}
      {/*  Testimonials                                                  */}
      {/* ============================================================= */}
      {visibility.showTestimonials && testimonials.length > 0 && (
        <section id="testimonials" className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold mb-8 text-center">What Clients Say</h2>
          <div className="space-y-6">
            {testimonials.slice(0, 4).map((t, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
              >
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <StarIcon key={j} filled={j < (t.rating || 5)} />
                  ))}
                </div>
                <p className="text-gray-700 italic leading-relaxed">
                  &ldquo;{t.text}&rdquo;
                </p>
                <p className="mt-3 font-semibold text-sm text-gray-900">
                  &mdash; {t.name}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================= */}
      {/*  Contact CTA                                                   */}
      {/* ============================================================= */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to find your dream home?
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Get a free home valuation or connect with {firstName} today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={`/agents/${profile.slug}/home-value`}
              className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-full text-sm font-semibold transition-colors shadow-sm"
            >
              {/* ChevronRight icon */}
              <span>Get Home Valuation</span>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            {visibility.showPhone && profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-full text-sm font-semibold transition-colors border border-blue-500"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Call {firstName}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/*  Footer                                                        */}
      {/* ============================================================= */}
      <footer className="text-center py-8 text-xs text-gray-400">
        <p>
          &copy; {new Date().getFullYear()} {profile.brokerage || "Kevv AI Inc."}. All
          Rights Reserved.
        </p>
        <p className="mt-2">Powered by Kevv AI</p>
      </footer>
    </div>
  );
}
