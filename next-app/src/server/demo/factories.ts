import type {
  AgentProfile,
  Contact,
  PostcardTemplate,
} from "@/lib/db/schema";

export function buildDemoAgentProfile(overrides: Partial<AgentProfile> = {}): Partial<AgentProfile> {
  return {
    id: 1,
    userId: 1,
    slug: "sophia-chen",
    email: "sophia@kevv.ai",
    name: "Sophia Chen",
    phone: "(650) 555-0182",
    title: "Luxury Real Estate Advisor",
    brokerage: "Kevv Private Client Group",
    licenseState: "CA",
    officeAddress: "555 University Ave, Palo Alto, CA",
    bookingUrl: "https://cal.com/kevv/sophia-chen",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    logoUrl: null,
    heroImageUrl: null,
    bio: "Bilingual Silicon Valley advisor focused on seller strategy, cross-border buyers, and AI-assisted listing marketing.",
    serviceAreas: ["Palo Alto", "Menlo Park", "Los Altos", "Cupertino"],
    specialties: ["Seller Strategy", "Luxury Listings", "Cross-border Buyers"],
    languages: ["English", "中文"],
    awards: ["Top 1% Bay Area Agent", "Luxury Home Marketing Specialist"],
    testimonials: [
      {
        name: "Grace L.",
        text: "Sophia turned our listing launch into a full campaign. We had leverage before the first open house.",
        rating: 5,
      },
    ],
    transactions: [
      {
        address: "1020 Bryant St",
        city: "Palo Alto",
        price: "$4.18M",
        type: "Seller",
      },
    ],
    neighborhoodKnowledge: {
      paloalto:
        "Palo Alto sellers care about school optics, lot utility, and buyer commute narratives. Launch copy should anchor those signals early.",
    },
    socialLinks: {
      instagram: "https://instagram.com/kevvai",
      linkedin: "https://linkedin.com/company/kevv-ai",
    },
    visibilitySettings: {
      showPhone: true,
      showEmail: true,
      showTransactions: true,
      showAwards: true,
      showTestimonials: true,
      showAddress: true,
    },
    yearsExperience: 12,
    templateId: "classic",
    colorScheme: "gold",
    status: "active",
    tier: "pro",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    lastPublishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildDemoContact(overrides: Partial<Contact> = {}): Partial<Contact> {
  return {
    id: 1,
    agentId: 1,
    agentProfileId: 1,
    conversationSessionId: null,
    externalId: null,
    source: "agent_site_form",
    sourceRef: "demo-agent-site",
    status: "qualified",
    score: "hot",
    intent: "selling",
    summary: "Owner requested a seller consultation and is evaluating list timing in the next 90 days.",
    name: "Daniel Park",
    firstName: "Daniel",
    lastName: "Park",
    email: "daniel@example.com",
    phone: "(650) 555-0139",
    wechatId: null,
    preferredLanguage: "en",
    budgetMin: null,
    budgetMax: null,
    area: "Menlo Park",
    timeline: "60-90 days",
    notes: "Requested comp-backed pricing guidance before renovation decisions.",
    tags: ["seller", "consultation", "high-intent"],
    metadata: {},
    addressLine1: "44 Oakview Dr",
    addressLine2: null,
    city: "Menlo Park",
    state: "CA",
    postalCode: "94025",
    country: "US",
    addressVerified: false,
    addressVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildDemoPostcardTemplate(
  overrides: Partial<PostcardTemplate> = {}
): Partial<PostcardTemplate> {
  return {
    id: 1,
    agentId: null,
    name: "Luxury Seller Consultation",
    category: "SELLER_CONSULTATION",
    isSystem: true,
    sizeCode: "6x9",
    thumbnailUrl: null,
    note: "Seller-facing postcard that invites homeowners into a direct consultation.",
    frontEditorState: null,
    backEditorState: null,
    frontRenderDefinition: null,
    backRenderDefinition: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
