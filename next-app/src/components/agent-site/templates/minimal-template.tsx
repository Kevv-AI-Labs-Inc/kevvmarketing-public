"use client";

import Link from "next/link";
import type { AgentProfile } from "@/lib/db/schema";

export type TemplateProps = {
  profile: AgentProfile;
  preview?: boolean;
};

/**
 * Minimal Template — editorial, whitespace-heavy, magazine-style.
 * Inspired by: Kinfolk, Cereal magazine, luxury brand lookbooks.
 */
export default function MinimalTemplate({ profile, preview = false }: TemplateProps) {
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
  const languages = (profile.languages ?? []) as string[];
  const awards = (profile.awards ?? []) as string[];
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

  const firstName = profile.name.split(" ")[0];

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#1a1a1a] font-sans">
      {/* ── Minimal Header ── */}
      <header className="px-6 md:px-12 py-6 flex justify-between items-center max-w-6xl mx-auto">
        <span className="text-xs tracking-[0.4em] uppercase text-gray-400 font-light">
          {profile.brokerage || "Real Estate"}
        </span>
        <a
          href="#contact"
          className="text-xs tracking-[0.3em] uppercase text-gray-400 hover:text-gray-900 transition-colors font-light"
        >
          Contact
        </a>
      </header>

      {/* ── Hero — Large photo + minimal text ── */}
      <section className="max-w-5xl mx-auto px-6 md:px-12 pb-20 md:pb-32">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-end">
          {/* Photo — 7/12 */}
          <div className="md:col-span-7 aspect-[3/4] md:aspect-[4/5] rounded-sm overflow-hidden">
            <img
              src={
                profile.heroImageUrl ||
                profile.photoUrl ||
                "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&h=1200&fit=crop&crop=faces"
              }
              alt={profile.name}
              className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-700"
              style={{ objectPosition: "50% 20%" }}
            />
          </div>

          {/* Text — 5/12 */}
          <div className="md:col-span-5 pb-4">
            <h1 className="text-4xl md:text-5xl font-light tracking-tight leading-[1.1] mb-6">
              {profile.name}
            </h1>
            <div className="w-8 h-px bg-gray-300 mb-6" />
            <p className="text-sm text-gray-500 leading-relaxed mb-6 font-light">
              {profile.bio?.slice(0, 200) ||
                `${profile.title || "Real Estate Agent"}. Guiding clients through every step with care and precision.`}
            </p>

            {serviceAreas.length > 0 && (
              <p className="text-xs text-gray-400 tracking-wider mb-8">
                {serviceAreas.slice(0, 3).join(" · ")}
              </p>
            )}

            <div className="space-y-3">
              {vis.showPhone && profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 transition-colors group"
                >
                  <svg
                    className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  {profile.phone}
                </a>
              )}
              {vis.showEmail && profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 transition-colors group"
                >
                  <svg
                    className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  {profile.email}
                </a>
              )}
              {vis.showAddress && profile.officeAddress && (
                <p className="flex items-center gap-3 text-sm text-gray-600">
                  <svg
                    className="h-3.5 w-3.5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {profile.officeAddress}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── About — editorial 3-col grid ── */}
      <section id="about" className="max-w-3xl mx-auto px-6 md:px-12 pb-20 md:pb-28">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <p className="text-xs tracking-[0.3em] uppercase text-gray-400 font-light">About</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-gray-600 leading-[1.8] font-light whitespace-pre-line">
              {profile.bio ||
                `${profile.name} is a dedicated real estate professional with an eye for detail and a passion for connecting people with their ideal homes.`}
            </p>

            {specialties.length > 0 && (
              <div className="mt-10 pt-8 border-t border-gray-200">
                <p className="text-xs tracking-[0.3em] uppercase text-gray-400 font-light mb-4">
                  Focus Areas
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {specialties.map((s) => (
                    <span key={s} className="text-sm text-gray-600 font-light">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {vis.showAwards && awards.length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-xs tracking-[0.3em] uppercase text-gray-400 font-light mb-4">
                  Recognition
                </p>
                <div className="space-y-2">
                  {awards.map((a) => (
                    <p key={a} className="text-sm text-gray-600 font-light">
                      {a}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {languages.length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-xs tracking-[0.3em] uppercase text-gray-400 font-light mb-4">
                  Languages
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {languages.map((l) => (
                    <span key={l} className="text-sm text-gray-600 font-light">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!!profile.yearsExperience && profile.yearsExperience > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-xs tracking-[0.3em] uppercase text-gray-400 font-light mb-2">
                  Experience
                </p>
                <p className="text-2xl font-light text-gray-900">
                  {profile.yearsExperience} years
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Transactions — table-style with border-b ── */}
      {vis.showTransactions && transactions.length > 0 && (
        <section id="transactions" className="max-w-3xl mx-auto px-6 md:px-12 pb-20 md:pb-28">
          <p className="text-xs tracking-[0.3em] uppercase text-gray-400 font-light mb-8">
            Selected Work
          </p>
          <div className="space-y-0">
            {transactions.slice(0, 8).map((tx, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-4 border-b border-gray-100 group hover:border-gray-300 transition-colors"
              >
                <div>
                  <p className="text-sm text-gray-900 font-normal">{tx.address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tx.city}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900 font-medium">{tx.price}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tx.type || "Closed"}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Testimonials — blockquote style ── */}
      {vis.showTestimonials && testimonials.length > 0 && (
        <section id="testimonials" className="max-w-3xl mx-auto px-6 md:px-12 pb-20 md:pb-28">
          <p className="text-xs tracking-[0.3em] uppercase text-gray-400 font-light mb-8">
            Kind Words
          </p>
          <div className="space-y-12">
            {testimonials.slice(0, 3).map((t, i) => (
              <div key={i}>
                <blockquote className="text-xl md:text-2xl font-light text-gray-800 leading-relaxed italic">
                  &ldquo;{t.text}&rdquo;
                </blockquote>
                <div className="mt-4 flex items-center gap-2">
                  <p className="text-xs tracking-[0.2em] uppercase text-gray-400 font-light">
                    &mdash; {t.name}
                  </p>
                  {t.rating > 0 && (
                    <span className="text-xs text-gray-300 font-light">
                      {"★".repeat(t.rating)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Contact CTA ── */}
      <section
        id="contact"
        className="max-w-3xl mx-auto px-6 md:px-12 pb-20 md:pb-28 text-center"
      >
        <div className="border-t border-gray-200 pt-16">
          <p className="text-xs tracking-[0.3em] uppercase text-gray-400 font-light mb-6">
            Get in Touch
          </p>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4">
            Work with {firstName}
          </h2>
          <p className="text-sm text-gray-500 font-light max-w-md mx-auto mb-10">
            Whether you&apos;re buying, selling, or planning your next move,{" "}
            {firstName} is here to help.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={profile.bookingUrl || `mailto:${profile.email}`}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm tracking-wider uppercase font-light border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
            >
              Discuss Selling My Home
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {profile.bookingUrl && (
              <a
                href={profile.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm tracking-wider uppercase font-light text-gray-500 hover:text-gray-900 transition-colors"
              >
                Book a Meeting
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            )}
          </div>

          {/* Contact details */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-400 font-light">
            {vis.showPhone && profile.phone && (
              <a href={`tel:${profile.phone}`} className="hover:text-gray-900 transition-colors">
                {profile.phone}
              </a>
            )}
            {vis.showEmail && profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="hover:text-gray-900 transition-colors"
              >
                {profile.email}
              </a>
            )}
            {vis.showAddress && profile.officeAddress && (
              <span>{profile.officeAddress}</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 text-center py-10">
        <p className="text-xs tracking-[0.3em] uppercase text-gray-300 font-light">
          &copy; {new Date().getFullYear()} {profile.brokerage || "Kevv AI Inc."}
        </p>
        <p className="mt-2 text-xs text-gray-300 tracking-wider font-light">Powered by Kevv AI</p>
      </footer>
    </div>
  );
}
