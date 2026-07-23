"use client";

import Link from "next/link";
import type { AgentProfile } from "@/lib/db/schema";

export type TemplateProps = {
  profile: AgentProfile;
  preview?: boolean;
};

/**
 * Classic Template — traditional, professional, top-down layout.
 * Serif typography, stone/amber palette, circular centered photo,
 * dark stone-900 header/hero/footer, warm amber accents, decorative dividers.
 */
export default function ClassicTemplate({
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
    <div className="min-h-screen bg-stone-50 text-stone-900 font-serif">
      {/* ── Dark Header with Nav ── */}
      <header className="bg-stone-900 text-white py-3">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <span className="text-sm tracking-widest uppercase font-sans">
            {profile.brokerage || "Real Estate"}
          </span>
          <nav className="hidden md:flex items-center gap-6 text-xs tracking-wider uppercase font-sans">
            <a
              href="#about"
              className="hover:text-amber-400 transition-colors"
            >
              About
            </a>
            {showTransactions && (
              <a
                href="#transactions"
                className="hover:text-amber-400 transition-colors"
              >
                Portfolio
              </a>
            )}
            {showTestimonials && (
              <a
                href="#testimonials"
                className="hover:text-amber-400 transition-colors"
              >
                Reviews
              </a>
            )}
            <a
              href="#contact"
              className="hover:text-amber-400 transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero — Centered photo + name ── */}
      <section
        className="bg-stone-900 text-white pb-16 pt-12 relative"
        style={
          profile.heroImageUrl
            ? {
                backgroundImage: `linear-gradient(to bottom, rgba(28,25,23,0.85), rgba(28,25,23,0.95)), url(${profile.heroImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center gap-8">
          {/* Circular photo */}
          <div className="w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden border-4 border-amber-500/40 shadow-2xl flex-shrink-0">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-stone-700 flex items-center justify-center text-5xl font-bold text-stone-400">
                {profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
            )}
          </div>

          {/* Name / title / actions */}
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              {profile.name}
            </h1>
            <p className="text-amber-400 text-lg font-sans tracking-wide">
              {profile.title || "Licensed Real Estate Agent"}
            </p>
            {serviceAreas.length > 0 && (
              <p className="text-stone-400 text-sm mt-2 font-sans flex items-center justify-center md:justify-start gap-1">
                {/* MapPin icon inline SVG */}
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {serviceAreas.slice(0, 3).join(" · ")}
              </p>
            )}
            <div className="flex gap-3 mt-5 justify-center md:justify-start flex-wrap">
              {vis.showPhone && profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-md text-sm font-sans font-semibold transition-colors"
                >
                  {/* Phone icon */}
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {profile.phone}
                </a>
              )}
              {vis.showEmail && profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="inline-flex items-center gap-2 border border-stone-600 hover:border-amber-500 text-white px-5 py-2.5 rounded-md text-sm font-sans transition-colors"
                >
                  {/* Mail icon */}
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  Email
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="bg-white border-y border-stone-200 py-8">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {(profile.yearsExperience ?? 0) > 0 && (
            <div>
              <p className="text-3xl font-bold text-stone-900">
                {profile.yearsExperience}+
              </p>
              <p className="text-xs text-stone-500 uppercase tracking-wider font-sans mt-1">
                Years in Business
              </p>
            </div>
          )}
          {transactions.length > 0 && (
            <div>
              <p className="text-3xl font-bold text-stone-900">
                {transactions.length}
              </p>
              <p className="text-xs text-stone-500 uppercase tracking-wider font-sans mt-1">
                Properties Sold
              </p>
            </div>
          )}
          {serviceAreas.length > 0 && (
            <div>
              <p className="text-3xl font-bold text-stone-900">
                {serviceAreas.length}
              </p>
              <p className="text-xs text-stone-500 uppercase tracking-wider font-sans mt-1">
                Service Areas
              </p>
            </div>
          )}
          {testimonials.length > 0 && (
            <div>
              <p className="text-3xl font-bold text-stone-900">
                {testimonials.length}
              </p>
              <p className="text-xs text-stone-500 uppercase tracking-wider font-sans mt-1">
                Happy Clients
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold mb-1 text-center">
          About {firstName}
        </h2>
        {/* Decorative divider */}
        <div className="w-12 h-0.5 bg-amber-500 mx-auto mt-3 mb-8" />
        <p className="text-stone-700 leading-relaxed text-lg text-center whitespace-pre-line">
          {profile.bio ||
            `${profile.name} brings dedication, expertise, and a client-first approach to every real estate transaction.`}
        </p>

        {/* Languages */}
        {languages.length > 1 && (
          <div className="mt-10 text-center">
            <h3 className="text-xs font-sans font-semibold uppercase tracking-widest text-stone-400 mb-4">
              Languages
            </h3>
            <p className="text-stone-700 font-sans text-sm">
              {languages.join(" · ")}
            </p>
          </div>
        )}

        {/* Specialties */}
        {specialties.length > 0 && (
          <div className="mt-10 text-center">
            <h3 className="text-xs font-sans font-semibold uppercase tracking-widest text-stone-400 mb-4">
              Areas of Expertise
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="border border-stone-300 text-stone-700 px-4 py-1.5 rounded-md text-sm font-sans"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Office address */}
        {vis.showAddress && profile.officeAddress && (
          <div className="mt-10 text-center">
            <h3 className="text-xs font-sans font-semibold uppercase tracking-widest text-stone-400 mb-4">
              Office
            </h3>
            <p className="text-stone-700 font-sans text-sm flex items-center justify-center gap-2">
              <svg
                className="h-4 w-4 text-stone-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {profile.officeAddress}
            </p>
          </div>
        )}
      </section>

      {/* ── Transactions ── */}
      {showTransactions && (
        <section
          id="transactions"
          className="bg-white py-16 border-t border-stone-200"
        >
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl font-bold mb-1 text-center">
              Transaction Portfolio
            </h2>
            <div className="w-12 h-0.5 bg-amber-500 mx-auto mt-3 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {transactions.slice(0, 8).map((tx, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border border-stone-200 rounded-lg p-4 hover:border-amber-400 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-stone-900 font-sans text-sm">
                      {tx.address}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {tx.type || "Closed"}
                      {tx.city && ` · ${tx.city}`}
                    </p>
                  </div>
                  <p className="font-bold text-stone-900 font-sans">
                    {tx.price}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Testimonials ── */}
      {showTestimonials && (
        <section id="testimonials" className="py-16">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold mb-1 text-center">
              Client Testimonials
            </h2>
            <div className="w-12 h-0.5 bg-amber-500 mx-auto mt-3 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {testimonials.slice(0, 4).map((t, i) => (
                <div
                  key={i}
                  className="bg-white border border-stone-200 rounded-lg p-6 shadow-sm"
                >
                  {/* Star rating */}
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(t.rating || 5)].map((_, j) => (
                      <svg
                        key={j}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
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
                  <p className="text-stone-700 italic leading-relaxed text-sm">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <p className="mt-4 font-bold text-xs text-stone-900 font-sans uppercase tracking-wider">
                    &mdash; {t.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Awards ── */}
      {showAwards && (
        <section className="bg-white border-t border-stone-200 py-16">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-1">Awards & Recognition</h2>
            <div className="w-12 h-0.5 bg-amber-500 mx-auto mt-3 mb-8" />
            <div className="space-y-2">
              {awards.map((a) => (
                <div
                  key={a}
                  className="flex items-center justify-center gap-2 text-stone-700 font-sans text-sm"
                >
                  {/* Award icon */}
                  <svg
                    className="h-4 w-4 text-amber-500"
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
          </div>
        </section>
      )}

      {/* ── Contact CTA ── */}
      <section
        id="contact"
        className="py-16 border-t border-stone-200 bg-stone-50"
      >
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-1">
            Work with {firstName}
          </h2>
          <div className="w-12 h-0.5 bg-amber-500 mx-auto mt-3 mb-6" />
          <p className="text-stone-600 font-sans text-sm mb-8">
            Ready to buy or sell? Schedule a direct consultation today.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Seller consultation CTA */}
            <Link
              href={profile.bookingUrl || `mailto:${profile.email}`}
              className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-md text-sm font-sans font-semibold transition-colors"
            >
              {/* Home icon */}
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Schedule a Seller Consultation
              {/* Arrow icon */}
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>

            {/* Booking URL if present */}
            {profile.bookingUrl && (
              <a
                href={profile.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border border-stone-300 hover:border-amber-500 text-stone-900 px-6 py-3 rounded-md text-sm font-sans font-semibold transition-colors"
              >
                {/* Calendar icon */}
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Book a Consultation
              </a>
            )}
          </div>

          {/* Contact details below CTA */}
          <div className="mt-8 flex flex-wrap gap-6 justify-center text-sm font-sans text-stone-500">
            {vis.showPhone && profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="hover:text-amber-600 transition-colors flex items-center gap-1.5"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {profile.phone}
              </a>
            )}
            {vis.showEmail && profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="hover:text-amber-600 transition-colors flex items-center gap-1.5"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                {profile.email}
              </a>
            )}
            {vis.showAddress && profile.officeAddress && (
              <span className="flex items-center gap-1.5">
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {profile.officeAddress}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-stone-900 text-white text-center py-8 text-xs font-sans">
        <p>
          &copy; {new Date().getFullYear()}{" "}
          {profile.brokerage || "All Rights Reserved"}.{" "}
          {profile.brokerage ? "All Rights Reserved." : ""}
        </p>
        <p className="mt-2 text-stone-500">Powered by Kevv AI</p>
      </footer>
    </div>
  );
}
