"use client";

import { useState, useEffect } from "react";
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Star,
  Twitter,
  Youtube,
} from "lucide-react";
import Link from "next/link";
import type { AgentProfile } from "@/lib/db/schema";

export type TemplateProps = {
  profile: AgentProfile;
  preview?: boolean;
};

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  facebook: <Facebook className="h-4 w-4" />,
  instagram: <Instagram className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
};

/**
 * Luxury Template — dark editorial, split-panel with full-bleed fixed photo.
 *
 * Left: 47% fixed hero image covering viewport height.
 * Right: 53% scrollable content — agent details, about, transactions, testimonials, contact.
 *
 * Inspired by high-end real estate agencies (The Agency, Compass Concierge, Sotheby's).
 */
export function LuxuryTemplate({ profile, preview = false }: TemplateProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (preview) return;
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [preview]);

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
  const socialLinks = (profile.socialLinks ?? {}) as Record<string, string>;

  const firstName = profile.name.split(" ")[0];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0f0f0f] text-[#e8e4df] font-sans">
      {/* ── Left: Fixed Hero Image Panel ── */}
      <div className="w-full lg:w-[47%] h-[50vh] lg:h-screen lg:fixed lg:left-0 top-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-black/20 z-10" />
        <img
          src={
            profile.heroImageUrl ||
            profile.photoUrl ||
            "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&h=1600&fit=crop&crop=faces"
          }
          alt={`${profile.name} - Real Estate Agent`}
          className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
          style={{ objectPosition: "50% 20%" }}
        />
        {/* Mobile overlay — visible below lg */}
        <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent lg:hidden z-20">
          <h1 className="text-3xl font-bold text-white uppercase tracking-widest mb-1">
            {profile.name}
          </h1>
          <p className="text-sm text-white/90 uppercase tracking-wider">
            {profile.title || "Real Estate Agent"}
          </p>
        </div>
      </div>

      {/* ── Right: Scrollable Content ── */}
      <div className="w-full lg:w-[53%] lg:ml-[47%] bg-[#0f0f0f] min-h-screen relative z-10 overflow-x-hidden">
        {/* Sticky Nav */}
        <header
          className={`sticky top-0 z-50 transition-all duration-300 ${
            isScrolled
              ? "bg-[#0f0f0f]/95 backdrop-blur-sm shadow-md py-2"
              : "bg-transparent py-4"
          }`}
        >
          <div className="w-full px-4 flex justify-between items-center gap-3">
            <span className="font-bold text-xs tracking-widest whitespace-nowrap text-[#e8e4df]/70">
              {(profile.brokerage || "KEVV AI").toUpperCase()}
            </span>

            <nav className="hidden lg:flex items-center gap-4 text-[11px] font-bold tracking-widest uppercase text-[#e8e4df]/50">
              <a href="#about" className="hover:text-[#c5a467] transition-colors">
                About
              </a>
              {vis.showTransactions !== false && transactions.length > 0 && (
                <a href="#transactions" className="hover:text-[#c5a467] transition-colors">
                  Transactions
                </a>
              )}
              {vis.showTestimonials !== false && testimonials.length > 0 && (
                <a href="#testimonials" className="hover:text-[#c5a467] transition-colors">
                  Testimonials
                </a>
              )}
              <a href="#contact" className="hover:text-[#c5a467] transition-colors">
                Contact
              </a>
            </nav>

            <a
              href="#contact"
              className="border border-[#c5a467] text-[#c5a467] hover:bg-[#c5a467] hover:text-[#0f0f0f] uppercase tracking-widest text-[11px] font-bold px-4 py-1.5 transition-colors"
            >
              Connect
            </a>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-8 py-10 md:px-12 md:py-14 lg:px-16 lg:py-16">
          {/* ── Agent Details (desktop only — mobile shows overlay) ── */}
          <section className="hidden lg:block animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.45em] text-[#e8e4df]/40">
              Personal Brand Site
            </p>

            <h1 className="text-5xl xl:text-6xl font-bold uppercase tracking-[0.18em] mb-4 leading-[0.94] text-[#e8e4df]">
              {profile.name.split(" ").map((part, i) => (
                <span key={i}>
                  {part}
                  {i < profile.name.split(" ").length - 1 && <br />}
                </span>
              ))}
            </h1>

            <h2 className="text-base text-[#e8e4df]/50 uppercase tracking-[0.35em] mb-8">
              {profile.title || "Licensed Real Estate Agent"}
            </h2>

            <div className="space-y-3 text-sm font-light tracking-wide mb-8">
              {vis.showPhone !== false && profile.phone && (
                <div className="flex items-center gap-3 group cursor-pointer">
                  <Phone className="h-4 w-4 text-[#c5a467] group-hover:scale-110 transition-transform" />
                  <a
                    href={`tel:${profile.phone.replace(/[^+\d]/g, "")}`}
                    className="group-hover:text-[#c5a467] transition-colors"
                  >
                    {profile.phone}
                  </a>
                </div>
              )}
              {vis.showEmail !== false && profile.email && (
                <div className="flex items-center gap-3 group cursor-pointer">
                  <Mail className="h-4 w-4 text-[#c5a467] group-hover:scale-110 transition-transform" />
                  <a
                    href={`mailto:${profile.email}`}
                    className="group-hover:text-[#c5a467] transition-colors"
                  >
                    {profile.email}
                  </a>
                </div>
              )}
              {serviceAreas.length > 0 && (
                <div className="flex items-center gap-3 group cursor-pointer">
                  <MapPin className="h-4 w-4 text-[#c5a467] group-hover:scale-110 transition-transform" />
                  <span className="group-hover:text-[#c5a467] transition-colors">
                    {serviceAreas.slice(0, 3).join(", ")}
                  </span>
                </div>
              )}
            </div>

            {/* Social Links */}
            {Object.keys(socialLinks).length > 0 && (
              <div className="flex gap-3">
                {Object.entries(socialLinks).map(
                  ([platform, url]) =>
                    url &&
                    SOCIAL_ICONS[platform] && (
                      <a
                        key={platform}
                        href={url}
                        title={platform}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 w-9 rounded-full border border-[#e8e4df]/20 flex items-center justify-center text-[#e8e4df]/50 hover:border-[#c5a467] hover:text-[#c5a467] hover:bg-[#c5a467]/10 transition-all duration-300"
                      >
                        {SOCIAL_ICONS[platform]}
                      </a>
                    )
                )}
              </div>
            )}
          </section>

          {/* Separator */}
          <div className="my-10 lg:my-12 h-px bg-[#e8e4df]/10" />

          {/* ── About ── */}
          <section id="about" className="mb-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.45em] text-[#c5a467] mb-6">
              About {firstName}
            </p>
            {profile.bio && (
              <p className="text-base leading-[1.85] text-[#e8e4df]/70 max-w-2xl whitespace-pre-line">
                {profile.bio}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
              {specialties.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.35em] text-[#e8e4df]/40 mb-3">
                    Specialties
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1 text-xs border border-[#e8e4df]/15 text-[#e8e4df]/60 tracking-wider"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {languages.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.35em] text-[#e8e4df]/40 mb-3">
                    Languages
                  </h3>
                  <p className="text-sm text-[#e8e4df]/60">{languages.join(", ")}</p>
                </div>
              )}
              {vis.showAwards !== false && awards.length > 0 && (
                <div className="md:col-span-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.35em] text-[#e8e4df]/40 mb-3">
                    Awards & Recognition
                  </h3>
                  <ul className="space-y-1.5 text-sm text-[#e8e4df]/60">
                    {awards.map((a) => (
                      <li key={a} className="flex items-center gap-2">
                        <span className="text-[#c5a467]">-</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* ── Transactions ── */}
          {vis.showTransactions !== false && transactions.length > 0 && (
            <section id="transactions" className="mb-16">
              <p className="text-[11px] font-bold uppercase tracking-[0.45em] text-[#c5a467] mb-6">
                Recent Transactions
              </p>
              <div className="space-y-0 border-t border-[#e8e4df]/10">
                {transactions.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-5 border-b border-[#e8e4df]/10 group hover:bg-[#e8e4df]/[0.02] transition-colors px-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-[#e8e4df]/80 group-hover:text-[#e8e4df] transition-colors">
                        {t.address}
                      </div>
                      <div className="text-xs text-[#e8e4df]/40 mt-0.5">
                        {t.city} &middot; {t.type}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-[#c5a467]">{t.price}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Testimonials ── */}
          {vis.showTestimonials !== false && testimonials.length > 0 && (
            <section id="testimonials" className="mb-16">
              <p className="text-[11px] font-bold uppercase tracking-[0.45em] text-[#c5a467] mb-6">
                Client Testimonials
              </p>
              <div className="space-y-8">
                {testimonials.map((t, i) => (
                  <div key={i} className="border-l-2 border-[#c5a467]/30 pl-6">
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star
                          key={si}
                          className={`h-3.5 w-3.5 ${
                            si < t.rating
                              ? "fill-[#c5a467] text-[#c5a467]"
                              : "text-[#e8e4df]/20"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-[#e8e4df]/60 italic">
                      &ldquo;{t.text}&rdquo;
                    </p>
                    <p className="text-xs text-[#e8e4df]/40 mt-2 uppercase tracking-wider">
                      &mdash; {t.name}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Contact ── */}
          <section id="contact" className="mb-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.45em] text-[#c5a467] mb-6">
              Get In Touch
            </p>
            <p className="text-sm text-[#e8e4df]/50 mb-8 max-w-xl">
              Ready to explore your options? Reach out and let&apos;s start the conversation.
            </p>
            <div className="flex flex-wrap gap-4">
              {vis.showPhone !== false && profile.phone && (
                <a
                  href={`tel:${profile.phone.replace(/[^+\d]/g, "")}`}
                  className="inline-flex items-center gap-2 border border-[#c5a467] text-[#c5a467] hover:bg-[#c5a467] hover:text-[#0f0f0f] px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
              )}
              {vis.showEmail !== false && profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="inline-flex items-center gap-2 border border-[#e8e4df]/20 text-[#e8e4df]/60 hover:border-[#c5a467] hover:text-[#c5a467] px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </a>
              )}
            </div>
          </section>

          {/* ── Footer ── */}
          <footer className="text-center text-[10px] text-[#e8e4df]/20 uppercase tracking-widest pb-8 pt-8 border-t border-[#e8e4df]/5">
            <p>
              &copy; {new Date().getFullYear()} {profile.brokerage || "Kevv AI Inc."}. All
              Rights Reserved.
            </p>
            <p className="mt-3 normal-case tracking-normal text-[#e8e4df]/15">
              Powered by Kevv AI
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
