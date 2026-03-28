export const agentSiteTemplateIds = [
  "classic",
  "modern",
  "bold",
  "elegant",
  "minimal",
  "urban",
  "luxury",
] as const;

export type AgentSiteTemplateId = (typeof agentSiteTemplateIds)[number];

export const agentSiteTemplateOptions: Array<{
  id: AgentSiteTemplateId;
  label: string;
  description: string;
}> = [
  {
    id: "classic",
    label: "Classic",
    description: "Warm serif storytelling with a polished private-client feel.",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Bright, crisp, and conversion-oriented with structured cards.",
  },
  {
    id: "bold",
    label: "Bold",
    description: "High-energy color, oversized headlines, and strong CTAs.",
  },
  {
    id: "elegant",
    label: "Elegant",
    description: "Soft glass surfaces and premium editorial spacing.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Quiet luxury layout with whitespace and concise copy.",
  },
  {
    id: "urban",
    label: "Urban",
    description: "Dark, high-contrast presentation for city-market positioning.",
  },
  {
    id: "luxury",
    label: "Luxury",
    description: "Deep contrast and private-office positioning for premium sellers.",
  },
];

export type AgentSiteVisibilitySettings = {
  showPhone: boolean;
  showEmail: boolean;
  showTransactions: boolean;
  showAwards: boolean;
  showTestimonials: boolean;
  showAddress: boolean;
};

function normalizeSegment(segment: string) {
  return segment
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildAgentSlug(value: string) {
  const slug = normalizeSegment(value);
  return slug.length > 0 ? slug : "agent-profile";
}

export function splitAndCleanList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function parseTestimonialsText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart = "", textPart = "", ratingPart = "5"] = line.split("|").map((item) => item.trim());
      return {
        name: namePart || "Client",
        text: textPart || line,
        rating: Number.isFinite(Number(ratingPart)) ? Math.min(5, Math.max(1, Number(ratingPart))) : 5,
      };
    });
}

export function serializeTestimonials(
  testimonials:
    | Array<{ name: string; text: string; rating: number }>
    | null
    | undefined
) {
  return (testimonials ?? [])
    .map((item) => [item.name, item.text, item.rating ?? 5].join(" | "))
    .join("\n");
}

export function parseTransactionsText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [address = "", city = "", price = "", type = "Seller"] = line
        .split("|")
        .map((item) => item.trim());
      return {
        address: address || line,
        city,
        price,
        type: type || "Seller",
      };
    });
}

export function serializeTransactions(
  transactions:
    | Array<{ address: string; city: string; price: string; type: string }>
    | null
    | undefined
) {
  return (transactions ?? [])
    .map((item) => [item.address, item.city, item.price, item.type].join(" | "))
    .join("\n");
}

export function sanitizeSocialLinks(record: Record<string, string | undefined | null>) {
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, value]) => [key, value?.trim() ?? ""] as const)
      .filter(([, value]) => value.length > 0)
  );
}
