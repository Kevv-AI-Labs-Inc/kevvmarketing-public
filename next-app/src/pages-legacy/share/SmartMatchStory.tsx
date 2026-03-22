// legacy page — incrementally migrated
/**
 * SmartMatchStory — Instagram Stories-style immersive property sharing
 *
 * Full-screen vertical cards with Ken Burns effect, strategy layer,
 * and Tinder-style Tour/Pass interactions.
 *
 * Card layers:
 *   1. Visual: Full-screen property image with Ken Burns animation
 *   2. Core Data: Price, address, beds/baths/sqft overlay
 *   3. Strategy: Agent's professional judgment (pitch + risk + strategy)
 *   4. Actions: Tour (👍) / Pass (👎) buttons
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useT } from "@/i18n";
import { pickText } from "@/i18n/copy";
import { sharePageCopy } from "@/i18n/share-pages";
import { Badge } from "@/components/ui/badge";
import {
    ThumbsUp,
    ThumbsDown,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Bed,
    Bath,
    Maximize,
    AlertTriangle,
    Lightbulb,
    Star,
    Eye,
    ExternalLink,
    ChevronUp,
    X,
    MessageCircle,
    Send,
    Phone as PhoneIcon,
    Mail as MailIcon,
    MapPin as MapPinIcon,
    Target,
    Trophy,
    ChevronDown,
    List,
    Navigation,
} from "lucide-react";
import { toast } from "sonner";

const STORY_GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() ?? "";
const STORY_MAP_UI_PROVIDER = (
    process.env.NEXT_PUBLIC_MAP_UI_PROVIDER?.trim().toLowerCase() || "google"
) as "google" | "none";

// ─── Types ───────────────────────────────────────────────

interface MlsListing {
    listingKey: string;
    address?: string;
    city?: string;
    state?: string;
    price?: string;
    beds?: string;
    baths?: string;
    sqft?: string;
    propertyType?: string;
    publicRemarks?: string;
    pitch?: string;
    riskNotes?: string;
    strategyTip?: string;
    matchAnalysis?: string;
    closingStrategy?: string;
    matchReasons?: string[];
    images?: string[];
    latitude?: string;
    longitude?: string;
}

interface ExternalListing {
    url: string;
    title?: string;
    image?: string;
    images?: string[];
    description?: string;
    address: string;
    price?: string;
    beds?: string;
    baths?: string;
    sqft?: string;
    source?: string;
    pitch?: string;
    riskNotes?: string;
    strategyTip?: string;
    matchAnalysis?: string;
    closingStrategy?: string;
    highlights?: string[];
    latitude?: string;
    longitude?: string;
}

interface ShareConfig {
    headerTitle: string;
    headerDescription?: string;
    accentColor?: string;
    strategyPoints?: string[];
}

interface FeedbackItem {
    listing_identifier: string;
    reaction: string;
    comment?: string;
}

interface StoryData {
    experienceMode: string;
    session: {
        token: string;
        clientName: string;
        clientNeeds: string;
        viewCount: number;
        createdAt: string;
    };
    shareConfig: ShareConfig;
    mlsListings: MlsListing[];
    externalListings: ExternalListing[];
    agentName: string;
    agentProfile?: {
        avatarUrl?: string;
        phone?: string;
        email?: string;
        wechatId?: string;
        title?: string;
    };
    aiWelcomeText?: string;
    marketBrief?: {
        summary?: string;
        avgPricePerSqft?: string;
        marketTrend?: string;
        inventoryLevel?: string;
        competitionLevel?: string;
        insights?: string[];
        recommendation?: string;
    };
    feedback: FeedbackItem[];
}

// Unified card type for rendering
interface StoryCard {
    id: string;
    type: "welcome" | "mls" | "external";
    image?: string;
    images?: string[];
    address: string;
    city?: string;
    price?: string;
    beds?: string;
    baths?: string;
    sqft?: string;
    pitch?: string;
    riskNotes?: string;
    strategyTip?: string;
    matchReasons?: string[];
    highlights?: string[];
    publicRemarks?: string;
    externalUrl?: string;
    source?: string;
    matchAnalysis?: string;
    closingStrategy?: string;
    latitude?: string;
    longitude?: string;
}

function normalizeCardImages(images?: string[], image?: string): string[] {
    const values = [image || "", ...(images || [])]
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    return Array.from(new Set(values));
}

interface SmartMatchStoryProps {
    data: StoryData;
    onFeedback: (params: {
        listingIdentifier: string;
        reaction: "like" | "dislike" | "neutral" | "tour_request";
        feedbackType: "reaction" | "comment" | "tour_request";
        listingType: "mls" | "external";
    }) => void;
    isFeedbackPending: boolean;
}

// ─── Ken Burns CSS Animation ──────────────────────────────

const kenBurnsKeyframes = `
@keyframes kenBurns {
  0% { transform: scale(1) translate(0, 0); }
  50% { transform: scale(1.08) translate(-1%, -1%); }
  100% { transform: scale(1.02) translate(0.5%, 0.5%); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(255,255,255,0.1); }
  50% { box-shadow: 0 0 40px rgba(255,255,255,0.2); }
}
@keyframes typeWriter {
  from { width: 0; }
  to { width: 100%; }
}
`;

// ─── Component ───────────────────────────────────────────

export function SmartMatchStory({ data, onFeedback, isFeedbackPending }: SmartMatchStoryProps) {
    const { locale } = useT();
    const copy = sharePageCopy.smartMatchStory;
    const pick = (value: { zh: string; en: string }) => pickText(locale, value);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showDetails, setShowDetails] = useState(false);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [localFeedback, setLocalFeedback] = useState<Record<string, string>>({});
    const [showComment, setShowComment] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [showList, setShowList] = useState(false);
    const [showRoute, setShowRoute] = useState(false);
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeData, setRouteData] = useState<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const routeRendererRef = useRef<any>(null);
    const [showAgentCard, setShowAgentCard] = useState(false);
    const [agentFooterHeight, setAgentFooterHeight] = useState(0);
    const agentFooterRef = useRef<HTMLDivElement>(null);
    const [galleryIndexByCard, setGalleryIndexByCard] = useState<Record<string, number>>({});

    const clearRenderedRoute = useCallback(() => {
        const current = routeRendererRef.current;
        if (!current) return;
        if (typeof current.setMap === "function") {
            current.setMap(null);
        } else if (typeof current.cleanup === "function") {
            current.cleanup();
        }
        routeRendererRef.current = null;
    }, []);

    const accentColor = data.shareConfig.accentColor || "#10b981";

    // Build unified card list: welcome card first, then all listings
    const cards: StoryCard[] = useMemo(() => {
        const result: StoryCard[] = [];

        // Welcome card (always first)
        result.push({
            id: "__welcome__",
            type: "welcome",
            address: "",
        });

        // MLS listings
        for (const listing of data.mlsListings) {
            const listingImages = normalizeCardImages(listing.images, listing.images?.[0]);
            result.push({
                id: `mls:${listing.listingKey}`,
                type: "mls",
                image: listingImages[0],
                images: listingImages,
                address: listing.address || "Address not available",
                city: listing.city,
                price: listing.price,
                beds: listing.beds,
                baths: listing.baths,
                sqft: listing.sqft,
                pitch: listing.pitch,
                riskNotes: listing.riskNotes,
                strategyTip: listing.strategyTip,
                matchReasons: listing.matchReasons,
                publicRemarks: listing.publicRemarks,
                matchAnalysis: (listing as any).matchAnalysis,
                closingStrategy: (listing as any).closingStrategy,
                latitude: (listing as any).latitude,
                longitude: (listing as any).longitude,
            });
        }

        // External listings
        for (const listing of data.externalListings) {
            const listingImages = normalizeCardImages(listing.images, listing.image);
            result.push({
                id: `ext:${listing.url}`,
                type: "external",
                image: listingImages[0],
                images: listingImages,
                address: listing.address,
                price: listing.price,
                beds: listing.beds,
                baths: listing.baths,
                sqft: listing.sqft,
                pitch: listing.pitch,
                riskNotes: listing.riskNotes,
                strategyTip: listing.strategyTip,
                highlights: listing.highlights,
                externalUrl: listing.url,
                source: listing.source,
                matchAnalysis: (listing as any).matchAnalysis,
                closingStrategy: (listing as any).closingStrategy,
                latitude: (listing as any).latitude,
                longitude: (listing as any).longitude,
            });
        }

        return result;
    }, [data.mlsListings, data.externalListings]);

    const totalCards = cards.length;
    const currentCard = cards[currentIndex];
    const isWelcome = currentCard?.type === "welcome";
    const currentGallery = useMemo(
        () => (currentCard && currentCard.type !== "welcome"
            ? normalizeCardImages(currentCard.images, currentCard.image)
            : []),
        [currentCard]
    );
    const currentGalleryIndex = currentCard
        ? Math.max(0, Math.min(galleryIndexByCard[currentCard.id] ?? 0, Math.max(0, currentGallery.length - 1)))
        : 0;
    const currentDisplayImage = currentGallery[currentGalleryIndex] || currentCard?.image;
    const actionButtonsBottom = `calc(${Math.max(24, (showMap ? 0 : agentFooterHeight) + 16)}px + env(safe-area-inset-bottom, 0px))`;

    useEffect(() => {
        const footer = agentFooterRef.current;
        if (!footer || showMap) {
            setAgentFooterHeight(0);
            return;
        }

        const updateHeight = () => {
            setAgentFooterHeight(Math.ceil(footer.getBoundingClientRect().height));
        };

        updateHeight();

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(() => updateHeight());
            observer.observe(footer);
        }
        window.addEventListener("resize", updateHeight);

        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", updateHeight);
        };
    }, [
        showAgentCard,
        showMap,
        data.agentProfile?.phone,
        data.agentProfile?.email,
        data.agentProfile?.wechatId,
        data.agentProfile?.title,
        data.agentProfile?.avatarUrl,
    ]);

    // Navigation
    const goNext = useCallback(() => {
        if (currentIndex < totalCards - 1) {
            setCurrentIndex((i) => i + 1);
            setShowDetails(false);
        }
    }, [currentIndex, totalCards]);

    const goPrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex((i) => i - 1);
            setShowDetails(false);
        }
    }, [currentIndex]);

    const goGalleryPrev = useCallback(() => {
        if (!currentCard || currentCard.type === "welcome") return;
        if (currentGallery.length <= 1) return;
        setGalleryIndexByCard((prev) => {
            const current = prev[currentCard.id] ?? 0;
            const next = current <= 0 ? currentGallery.length - 1 : current - 1;
            return { ...prev, [currentCard.id]: next };
        });
    }, [currentCard, currentGallery.length]);

    const goGalleryNext = useCallback(() => {
        if (!currentCard || currentCard.type === "welcome") return;
        if (currentGallery.length <= 1) return;
        setGalleryIndexByCard((prev) => {
            const current = prev[currentCard.id] ?? 0;
            const next = (current + 1) % currentGallery.length;
            return { ...prev, [currentCard.id]: next };
        });
    }, [currentCard, currentGallery.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
            if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
            if (e.key === "ArrowUp") { e.preventDefault(); setShowDetails(true); }
            if (e.key === "ArrowDown" || e.key === "Escape") { e.preventDefault(); setShowDetails(false); }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [goNext, goPrev]);

    // ─── Map initialization (Google) ───
    useEffect(() => {
        if (!showMap || !mapContainerRef.current) return;
        if (STORY_MAP_UI_PROVIDER === "none") return;

        const propertyCards = cards.filter(
            (c) => c.type !== "welcome" && c.latitude && c.longitude
        );
        if (propertyCards.length === 0) return;

        const createPriceLabel = (price: string | undefined, index: number) => {
            const priceNum = parseFloat((price || "").replace(/[$,]/g, ""));
            if (Number.isFinite(priceNum) && priceNum >= 1_000_000) {
                return `$${(priceNum / 1_000_000).toFixed(1)}M`;
            }
            if (Number.isFinite(priceNum) && priceNum >= 1_000) {
                return `$${Math.round(priceNum / 1_000)}K`;
            }
            return price || `#${index + 1}`;
        };

        const loadGoogleMapsApi = (): Promise<void> => {
            if ((window as any).google?.maps?.Map) return Promise.resolve();
            return new Promise((resolve, reject) => {
                if (document.querySelector("script[src*='maps.googleapis.com']")) {
                    const check = setInterval(() => {
                        if ((window as any).google?.maps?.Map) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 100);
                    setTimeout(() => {
                        clearInterval(check);
                        reject(new Error("Google Maps API timeout"));
                    }, 10000);
                    return;
                }

                const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
                if (!apiKey) {
                    reject(new Error("VITE_GOOGLE_MAPS_API_KEY is missing"));
                    return;
                }

                const script = document.createElement("script");
                script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
                    apiKey
                )}&libraries=marker`;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Failed to load Google Maps API"));
                document.head.appendChild(script);
            });
        };

        let cancelled = false;
        clearRenderedRoute();
        routeData && setRouteData(null);
        showRoute && setShowRoute(false);

        const run = async () => {
            await loadGoogleMapsApi();
            if (cancelled || !mapContainerRef.current) return;

            const bounds = new (window as any).google.maps.LatLngBounds();
            propertyCards.forEach((c) =>
                bounds.extend({ lat: c.latitude!, lng: c.longitude! })
            );

            const mapOptions: Record<string, unknown> = {
                center: bounds.getCenter(),
                zoom: 12,
                mapId: STORY_GOOGLE_MAP_ID || undefined,
                disableDefaultUI: true,
                zoomControl: true,
            };

            if (!STORY_GOOGLE_MAP_ID) {
                mapOptions.styles = [
                    { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
                    { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
                    { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
                    { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
                    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
                    { featureType: "poi", stylers: [{ visibility: "off" }] },
                ];
            }

            const map = new (window as any).google.maps.Map(
                mapContainerRef.current,
                mapOptions
            );
            map.fitBounds(bounds, 50);
            mapInstanceRef.current = map;

            const newMarkers: any[] = [];
            const infoWindow = new (window as any).google.maps.InfoWindow();

            propertyCards.forEach((card, idx) => {
                const priceLabel = createPriceLabel(card.price, idx);
                const markerEl = document.createElement("div");
                markerEl.style.cssText = `
                    background: white;
                    color: #1a1a2e;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 700;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    cursor: pointer;
                    white-space: nowrap;
                    border: 2px solid #10b981;
                    transition: transform 0.2s;
                `;
                markerEl.textContent = priceLabel;
                markerEl.addEventListener("mouseenter", () => {
                    markerEl.style.transform = "scale(1.15)";
                });
                markerEl.addEventListener("mouseleave", () => {
                    markerEl.style.transform = "scale(1)";
                });

                try {
                    const marker = new (window as any).google.maps.marker.AdvancedMarkerElement({
                        map,
                        position: { lat: card.latitude!, lng: card.longitude! },
                        content: markerEl,
                        title: card.address,
                    });
                    marker.addListener("click", () => {
                        const content = `
                            <div style="max-width:240px;font-family:system-ui,sans-serif;">
                                ${card.image ? `<img src="${card.image}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />` : ""}
                                <div style="font-weight:700;color:#10b981;font-size:16px;">${card.price || pick(copy.listPriceUnavailable)}</div>
                                <div style="font-size:13px;color:#333;margin-top:2px;">${card.address}</div>
                            </div>
                        `;
                        infoWindow.setContent(content);
                        infoWindow.open(map, marker);
                    });
                    newMarkers.push(marker);
                } catch {
                    const marker = new (window as any).google.maps.Marker({
                        map,
                        position: { lat: card.latitude!, lng: card.longitude! },
                        label: { text: priceLabel, color: "#1a1a2e", fontWeight: "700", fontSize: "11px" },
                        icon: {
                            path: (window as any).google.maps.SymbolPath.CIRCLE,
                            fillColor: "white",
                            fillOpacity: 1,
                            strokeColor: "#10b981",
                            strokeWeight: 2,
                            scale: 28,
                        },
                    });
                    newMarkers.push(marker);
                }
            });

            markersRef.current = newMarkers;
        };

        run().catch((err) => {
            console.warn("[Map] Failed to initialize:", err);
        });

        return () => {
            cancelled = true;
            const map = mapInstanceRef.current;
            markersRef.current.forEach((marker) => {
                if (typeof marker?.setMap === "function") {
                    marker.setMap(null);
                } else if (map?.markers?.remove) {
                    map.markers.remove(marker);
                } else if (marker?.map) {
                    marker.map = null;
                }
            });
            markersRef.current = [];
            clearRenderedRoute();
            mapInstanceRef.current = null;
        };
    }, [showMap, cards, clearRenderedRoute]);

    // Touch swipe support
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.touches[0].clientX);
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX === null) return;
        const diff = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(diff) > 50) {
            if (diff < 0) goNext();
            else goPrev();
        }
        setTouchStartX(null);
    };

    // Feedback handler
    const handleReaction = (reaction: "like" | "dislike" | "tour_request") => {
        if (!currentCard || isWelcome) return;
        const identifier = currentCard.id;
        const listingType = currentCard.type === "external" ? "external" as const : "mls" as const;
        const feedbackType = reaction === "tour_request" ? "tour_request" as const : "reaction" as const;

        setLocalFeedback((prev) => ({ ...prev, [identifier]: reaction }));
        onFeedback({ listingIdentifier: identifier, reaction, feedbackType, listingType });

        // Auto-advance after feedback
        setTimeout(() => goNext(), 400);
    };

    // Comment handler
    const handleSubmitComment = async () => {
        if (!currentCard || isWelcome || !commentText.trim()) return;
        setIsSubmittingComment(true);
        try {
            const token = data.session?.token;
            const origin = window.location.origin;
            const response = await fetch(`${origin}/api/trpc/smartMatch.submitComment`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    json: {
                        token,
                        listingIdentifier: currentCard.id,
                        commentText: commentText.trim(),
                        listingType: currentCard.type === "external" ? "external" : "mls",
                    },
                }),
            });
            if (response.ok) {
                toast.success(pick(copy.commentSubmitted));
                setCommentText("");
                setShowComment(false);
            } else {
                toast.error(pick(copy.commentFailed));
            }
        } catch {
            toast.error(pick(copy.networkError));
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const formatPrice = (price?: string) => {
        if (!price) return "";
        const num = Number(price.replace(/[^0-9.]/g, ""));
        if (isNaN(num)) return price;
        if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
        if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
        return `$${num.toLocaleString()}`;
    };

    const existingFeedback = (id: string) => {
        if (localFeedback[id]) return localFeedback[id];
        const fb = data.feedback.find((f) => f.listing_identifier === id);
        return fb?.reaction;
    };

    return (
        <>
            <style>{kenBurnsKeyframes}</style>
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "#000",
                    overflow: "hidden",
                    fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                    userSelect: "none",
                    maxWidth: "430px",
                    margin: "0 auto",
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* ─── Progress Bar ─── */}
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    display: "flex",
                    gap: "3px",
                    padding: "12px 12px 0",
                }}>
                    {cards.map((_, i) => (
                        <div key={i} style={{
                            flex: 1,
                            height: "3px",
                            borderRadius: "2px",
                            background: i <= currentIndex
                                ? "rgba(255,255,255,0.9)"
                                : "rgba(255,255,255,0.25)",
                            transition: "background 0.3s ease",
                        }} />
                    ))}
                </div>

                {/* ─── Welcome Card ─── */}
                {isWelcome && (
                    <div style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "40px 24px",
                        background: `linear-gradient(135deg, #0f172a, #1e293b, ${accentColor}22)`,
                    }}>
                        {/* Agent avatar placeholder */}
                        <div style={{
                            width: "80px",
                            height: "80px",
                            borderRadius: "50%",
                            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}88)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "32px",
                            fontWeight: 700,
                            color: "white",
                            marginBottom: "20px",
                            animation: "fadeInUp 0.6s ease-out",
                        }}>
                            {(data.agentName || "A")[0].toUpperCase()}
                        </div>

                        {/* Greeting */}
                        <h1 style={{
                            color: "white",
                            fontSize: "28px",
                            fontWeight: 700,
                            textAlign: "center",
                            marginBottom: "8px",
                            animation: "fadeInUp 0.6s ease-out 0.2s both",
                        }}>
                            {pick(copy.greeting(data.session.clientName || ""))}
                        </h1>

                        <p style={{
                            color: "rgba(255,255,255,0.5)",
                            fontSize: "14px",
                            marginBottom: "24px",
                            animation: "fadeInUp 0.6s ease-out 0.3s both",
                        }}>
                            {pick(copy.curatedBy(data.agentName))}
                        </p>

                        {/* Welcome text */}
                        {data.aiWelcomeText && (
                            <div style={{
                                background: "rgba(255,255,255,0.06)",
                                borderRadius: "16px",
                                padding: "20px 24px",
                                maxWidth: "340px",
                                marginBottom: "32px",
                                border: "1px solid rgba(255,255,255,0.08)",
                                animation: "fadeInUp 0.6s ease-out 0.4s both",
                            }}>
                                <p style={{
                                    color: "rgba(255,255,255,0.85)",
                                    fontSize: "15px",
                                    lineHeight: 1.7,
                                    margin: 0,
                                }}>
                                    {data.aiWelcomeText}
                                </p>
                            </div>
                        )}

                        {/* Stats row */}
                        <div style={{
                            display: "flex",
                            gap: "24px",
                            marginBottom: "40px",
                            animation: "fadeInUp 0.6s ease-out 0.5s both",
                        }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ color: accentColor, fontSize: "28px", fontWeight: 700 }}>
                                    {totalCards - 1}
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
                                    {pick(copy.featuredCount)}
                                </div>
                            </div>
                            {data.marketBrief?.avgPricePerSqft && (
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ color: accentColor, fontSize: "28px", fontWeight: 700 }}>
                                        {data.marketBrief.avgPricePerSqft}
                                    </div>
                                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
                                        {pick(copy.avgPricePerSqft)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Market brief summary */}
                        {data.marketBrief?.summary && (
                            <div style={{
                                background: `${accentColor}15`,
                                borderRadius: "12px",
                                padding: "14px 18px",
                                maxWidth: "340px",
                                marginBottom: "32px",
                                borderLeft: `3px solid ${accentColor}`,
                                animation: "fadeInUp 0.6s ease-out 0.6s both",
                            }}>
                                <p style={{
                                    color: "rgba(255,255,255,0.7)",
                                    fontSize: "13px",
                                    lineHeight: 1.6,
                                    margin: 0,
                                }}>
                                    📊 {data.marketBrief.summary}
                                </p>
                            </div>
                        )}

                        {/* CTA */}
                        <button
                            onClick={goNext}
                            style={{
                                background: accentColor,
                                color: "white",
                                border: "none",
                                borderRadius: "50px",
                                padding: "14px 40px",
                                fontSize: "16px",
                                fontWeight: 600,
                                cursor: "pointer",
                                animation: "fadeInUp 0.6s ease-out 0.7s both, pulseGlow 2s ease-in-out infinite 1.3s",
                                transition: "transform 0.2s",
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        >
                            {pick(copy.start)}
                        </button>
                    </div>
                )}

                {/* ─── Property Card ─── */}
                {!isWelcome && currentCard && (
                    <>
                        {/* Background Image with Ken Burns */}
                        <div style={{
                            position: "absolute",
                            inset: 0,
                            animation: "kenBurns 20s ease-in-out infinite alternate",
                        }}>
                            {currentDisplayImage ? (
                                <img
                                    src={currentDisplayImage}
                                    alt={currentCard.address}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: "100%",
                                    height: "100%",
                                    background: `linear-gradient(135deg, #1e293b, ${accentColor}44, #0f172a)`,
                                }} />
                            )}
                        </div>

                        {/* Gradient overlays */}
                        <div style={{
                            position: "absolute",
                            inset: 0,
                            background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.92) 100%)",
                            zIndex: 1,
                        }} />

                        {/* Card counter */}
                        <div style={{
                            position: "absolute",
                            top: "28px",
                            right: "16px",
                            zIndex: 10,
                            background: "rgba(0,0,0,0.5)",
                            borderRadius: "20px",
                            padding: "6px 12px",
                            color: "rgba(255,255,255,0.8)",
                            fontSize: "13px",
                            fontWeight: 500,
                            backdropFilter: "blur(10px)",
                        }}>
                            {currentIndex}/{totalCards - 1}
                        </div>

                        {/* Gallery controls */}
                        {currentGallery.length > 1 && (
                            <>
                                <div style={{
                                    position: "absolute",
                                    top: "28px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    zIndex: 10,
                                    background: "rgba(0,0,0,0.45)",
                                    color: "white",
                                    borderRadius: "16px",
                                    padding: "4px 10px",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    backdropFilter: "blur(8px)",
                                }}>
                                    {pick(copy.galleryCounter(currentGalleryIndex + 1, currentGallery.length))}
                                </div>
                                <div style={{
                                    position: "absolute",
                                    top: "68px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    zIndex: 10,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            goGalleryPrev();
                                        }}
                                        style={{
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "50%",
                                            border: "1px solid rgba(255,255,255,0.25)",
                                            background: "rgba(0,0,0,0.45)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                            backdropFilter: "blur(8px)",
                                        }}
                                        aria-label={pick(copy.prevImage)}
                                    >
                                        <ChevronLeft size={14} color="white" />
                                    </button>
                                    <div style={{ display: "flex", gap: "4px" }}>
                                        {currentGallery.slice(0, 8).map((_, idx) => (
                                            <span
                                                key={idx}
                                                style={{
                                                    width: "6px",
                                                    height: "6px",
                                                    borderRadius: "999px",
                                                    background: idx === currentGalleryIndex
                                                        ? "rgba(255,255,255,0.95)"
                                                        : "rgba(255,255,255,0.35)",
                                                }}
                                            />
                                        ))}
                                        {currentGallery.length > 8 && (
                                            <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "10px", marginLeft: "2px" }}>
                                                +{currentGallery.length - 8}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            goGalleryNext();
                                        }}
                                        style={{
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "50%",
                                            border: "1px solid rgba(255,255,255,0.25)",
                                            background: "rgba(0,0,0,0.45)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                            backdropFilter: "blur(8px)",
                                        }}
                                        aria-label={pick(copy.nextImage)}
                                    >
                                        <ChevronRight size={14} color="white" />
                                    </button>
                                </div>
                            </>
                        )}

                        {/* External source badge */}
                        {currentCard.source && (
                            <div style={{
                                position: "absolute",
                                top: "28px",
                                left: "16px",
                                zIndex: 10,
                            }}>
                                <Badge variant="secondary" style={{
                                    background: "rgba(0,0,0,0.5)",
                                    color: "white",
                                    backdropFilter: "blur(10px)",
                                    fontSize: "12px",
                                }}>
                                    {currentCard.source}
                                </Badge>
                            </div>
                        )}

                        {/* Feedback indicator */}
                        {existingFeedback(currentCard.id) && (
                            <div style={{
                                position: "absolute",
                                top: "70px",
                                right: "16px",
                                zIndex: 10,
                                background: existingFeedback(currentCard.id) === "dislike"
                                    ? "rgba(239,68,68,0.8)"
                                    : `${accentColor}cc`,
                                borderRadius: "50%",
                                width: "36px",
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backdropFilter: "blur(10px)",
                            }}>
                                {existingFeedback(currentCard.id) === "dislike"
                                    ? <ThumbsDown size={16} color="white" />
                                    : existingFeedback(currentCard.id) === "tour_request"
                                        ? <Star size={16} color="white" />
                                        : <ThumbsUp size={16} color="white" />
                                }
                            </div>
                        )}

                        {/* ─── Layer 2: Core Data ─── */}
                        <div style={{
                            position: "absolute",
                            bottom: showDetails ? "45%" : "160px",
                            left: 0,
                            right: 0,
                            zIndex: 10,
                            padding: "0 20px",
                            transition: "bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}>
                            {/* Price */}
                            <div style={{
                                fontSize: "36px",
                                fontWeight: 800,
                                color: "white",
                                letterSpacing: "-0.02em",
                                marginBottom: "6px",
                                animation: "slideInLeft 0.4s ease-out",
                                textShadow: "0 2px 20px rgba(0,0,0,0.5)",
                            }}>
                                {formatPrice(currentCard.price) || pick(copy.priceUnavailable)}
                            </div>

                            {/* Address */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                marginBottom: "10px",
                                animation: "slideInLeft 0.4s ease-out 0.1s both",
                            }}>
                                <MapPin size={14} color="rgba(255,255,255,0.7)" />
                                <span style={{
                                    color: "rgba(255,255,255,0.85)",
                                    fontSize: "15px",
                                    fontWeight: 500,
                                }}>
                                    {currentCard.address}
                                    {currentCard.city ? `, ${currentCard.city}` : ""}
                                </span>
                            </div>

                            {/* Property stats */}
                            <div style={{
                                display: "flex",
                                gap: "16px",
                                animation: "slideInLeft 0.4s ease-out 0.2s both",
                            }}>
                                {currentCard.beds && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                        <Bed size={14} color={accentColor} />
                                        <span style={{ color: "white", fontSize: "14px", fontWeight: 600 }}>
                                            {currentCard.beds}
                                        </span>
                                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>BD</span>
                                    </div>
                                )}
                                {currentCard.baths && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                        <Bath size={14} color={accentColor} />
                                        <span style={{ color: "white", fontSize: "14px", fontWeight: 600 }}>
                                            {currentCard.baths}
                                        </span>
                                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>BA</span>
                                    </div>
                                )}
                                {currentCard.sqft && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                        <Maximize size={14} color={accentColor} />
                                        <span style={{ color: "white", fontSize: "14px", fontWeight: 600 }}>
                                            {Number(currentCard.sqft).toLocaleString()}
                                        </span>
                                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>sqft</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── Layer 3: Strategy Judgment ─── */}
                        <div style={{
                            position: "absolute",
                            bottom: showDetails ? "8%" : "84px",
                            left: 0,
                            right: 0,
                            zIndex: 10,
                            padding: "0 20px",
                            transition: "bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s",
                        }}>
                            {/* Toggle details button */}
                            {!showDetails && currentCard.pitch && (
                                <button
                                    onClick={() => setShowDetails(true)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        background: "rgba(255,255,255,0.08)",
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        borderRadius: "20px",
                                        padding: "8px 14px",
                                        color: "rgba(255,255,255,0.7)",
                                        fontSize: "13px",
                                        cursor: "pointer",
                                        backdropFilter: "blur(10px)",
                                        marginBottom: "12px",
                                    }}
                                >
                                    <ChevronUp size={14} />
                                    {pick(copy.expertJudgment(data.agentName))}
                                </button>
                            )}

                            {/* Expanded strategy panel */}
                            {showDetails && (
                                <div style={{
                                    background: "rgba(0,0,0,0.75)",
                                    backdropFilter: "blur(20px)",
                                    borderRadius: "16px",
                                    padding: "18px",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    animation: "fadeInUp 0.3s ease-out",
                                    maxHeight: "45vh",
                                    overflowY: "auto",
                                }}>
                                    {/* Close button */}
                                    <button
                                        onClick={() => setShowDetails(false)}
                                        style={{
                                            position: "absolute",
                                            top: "-40px",
                                            right: "20px",
                                            background: "rgba(255,255,255,0.1)",
                                            border: "none",
                                            borderRadius: "50%",
                                            width: "32px",
                                            height: "32px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <X size={16} color="white" />
                                    </button>

                                    {/* Pitch */}
                                    {currentCard.pitch && (
                                        <div style={{ marginBottom: "14px" }}>
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                marginBottom: "8px",
                                            }}>
                                                <Star size={14} color={accentColor} />
                                                <span style={{
                                                    color: accentColor,
                                                    fontSize: "12px",
                                                    fontWeight: 700,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                }}>
                                                    {pick(copy.recommendation)}
                                                </span>
                                            </div>
                                            <p style={{
                                                color: "rgba(255,255,255,0.85)",
                                                fontSize: "14px",
                                                lineHeight: 1.65,
                                                margin: 0,
                                            }}>
                                                {currentCard.pitch}
                                            </p>
                                        </div>
                                    )}

                                    {/* Risk notes */}
                                    {currentCard.riskNotes && (
                                        <div style={{
                                            background: "rgba(239,68,68,0.1)",
                                            borderRadius: "10px",
                                            padding: "10px 14px",
                                            marginBottom: "10px",
                                            borderLeft: "3px solid rgba(239,68,68,0.5)",
                                        }}>
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                marginBottom: "4px",
                                            }}>
                                                <AlertTriangle size={13} color="#ef4444" />
                                                <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>
                                                    {pick(copy.risks)}
                                                </span>
                                            </div>
                                            <p style={{
                                                color: "rgba(255,255,255,0.7)",
                                                fontSize: "13px",
                                                lineHeight: 1.5,
                                                margin: 0,
                                            }}>
                                                {currentCard.riskNotes}
                                            </p>
                                        </div>
                                    )}

                                    {/* Strategy tip */}
                                    {currentCard.strategyTip && (
                                        <div style={{
                                            background: `${accentColor}15`,
                                            borderRadius: "10px",
                                            padding: "10px 14px",
                                            marginBottom: "10px",
                                            borderLeft: `3px solid ${accentColor}`,
                                        }}>
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                marginBottom: "4px",
                                            }}>
                                                <Lightbulb size={13} color={accentColor} />
                                                <span style={{ color: accentColor, fontSize: "12px", fontWeight: 600 }}>
                                                    {pick(copy.strategy)}
                                                </span>
                                            </div>
                                            <p style={{
                                                color: "rgba(255,255,255,0.7)",
                                                fontSize: "13px",
                                                lineHeight: 1.5,
                                                margin: 0,
                                            }}>
                                                {currentCard.strategyTip}
                                            </p>
                                        </div>
                                    )}

                                    {/* Match reasons / highlights */}
                                    {(currentCard.matchReasons?.length || currentCard.highlights?.length) && (
                                        <div style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: "6px",
                                            marginTop: "8px",
                                        }}>
                                            {(currentCard.matchReasons || currentCard.highlights || []).map((reason, i) => (
                                                <span key={i} style={{
                                                    background: "rgba(255,255,255,0.08)",
                                                    borderRadius: "6px",
                                                    padding: "4px 10px",
                                                    color: "rgba(255,255,255,0.6)",
                                                    fontSize: "12px",
                                                }}>
                                                    {reason}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Match Analysis (LLM) */}
                                    {currentCard.matchAnalysis && (
                                        <div style={{
                                            background: "rgba(59,130,246,0.1)",
                                            borderRadius: "10px",
                                            padding: "10px 14px",
                                            marginBottom: "10px",
                                            borderLeft: "3px solid rgba(59,130,246,0.5)",
                                        }}>
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                marginBottom: "4px",
                                            }}>
                                                <Target size={13} color="#3b82f6" />
                                                <span style={{ color: "#3b82f6", fontSize: "12px", fontWeight: 600 }}>
                                                    {pick(copy.matchAnalysis)}
                                                </span>
                                            </div>
                                            <p style={{
                                                color: "rgba(255,255,255,0.8)",
                                                fontSize: "13px",
                                                lineHeight: 1.5,
                                                margin: 0,
                                            }}>
                                                {currentCard.matchAnalysis}
                                            </p>
                                        </div>
                                    )}

                                    {/* Closing Strategy (LLM) */}
                                    {currentCard.closingStrategy && (
                                        <div style={{
                                            background: "rgba(168,85,247,0.1)",
                                            borderRadius: "10px",
                                            padding: "10px 14px",
                                            marginBottom: "10px",
                                            borderLeft: "3px solid rgba(168,85,247,0.5)",
                                        }}>
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                marginBottom: "4px",
                                            }}>
                                                <Trophy size={13} color="#a855f7" />
                                                <span style={{ color: "#a855f7", fontSize: "12px", fontWeight: 600 }}>
                                                    {pick(copy.closingStrategy)}
                                                </span>
                                            </div>
                                            <p style={{
                                                color: "rgba(255,255,255,0.8)",
                                                fontSize: "13px",
                                                lineHeight: 1.5,
                                                margin: 0,
                                            }}>
                                                {currentCard.closingStrategy}
                                            </p>
                                        </div>
                                    )}

                                    {/* External link */}
                                    {currentCard.externalUrl && (
                                        <a
                                            href={currentCard.externalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                color: accentColor,
                                                fontSize: "13px",
                                                marginTop: "12px",
                                                textDecoration: "none",
                                            }}
                                        >
                                            <ExternalLink size={13} />
                                            {pick(copy.viewOriginal)}
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ─── Layer 4: Action Buttons ─── */}
                        <div style={{
                            position: "absolute",
                            bottom: actionButtonsBottom,
                            left: 0,
                            right: 0,
                            zIndex: 20,
                            display: "flex",
                            justifyContent: "center",
                            gap: "16px",
                            padding: "0 20px",
                        }}>
                            {/* Pass button */}
                            <button
                                onClick={() => handleReaction("dislike")}
                                disabled={isFeedbackPending}
                                style={{
                                    width: "64px",
                                    height: "64px",
                                    borderRadius: "50%",
                                    border: "2px solid rgba(255,255,255,0.2)",
                                    background: existingFeedback(currentCard.id) === "dislike"
                                        ? "rgba(239,68,68,0.8)"
                                        : "rgba(255,255,255,0.06)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    backdropFilter: "blur(10px)",
                                    transition: "all 0.2s",
                                }}
                            >
                                <ThumbsDown size={24} color="white" />
                            </button>

                            {/* Tour request button */}
                            <button
                                onClick={() => handleReaction("tour_request")}
                                disabled={isFeedbackPending}
                                style={{
                                    width: "72px",
                                    height: "72px",
                                    borderRadius: "50%",
                                    border: "none",
                                    background: existingFeedback(currentCard.id) === "tour_request"
                                        ? accentColor
                                        : `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    boxShadow: `0 4px 20px ${accentColor}66`,
                                    transition: "all 0.2s",
                                }}
                            >
                                <Eye size={22} color="white" />
                                <span style={{ color: "white", fontSize: "9px", fontWeight: 600, marginTop: "2px" }}>
                                    {pick(copy.tour)}
                                </span>
                            </button>

                            {/* Like button */}
                            <button
                                onClick={() => handleReaction("like")}
                                disabled={isFeedbackPending}
                                style={{
                                    width: "64px",
                                    height: "64px",
                                    borderRadius: "50%",
                                    border: "2px solid rgba(255,255,255,0.2)",
                                    background: existingFeedback(currentCard.id) === "like"
                                        ? `${accentColor}cc`
                                        : "rgba(255,255,255,0.06)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    backdropFilter: "blur(10px)",
                                    transition: "all 0.2s",
                                }}
                            >
                                <ThumbsUp size={24} color="white" />
                            </button>

                            {/* Comment button */}
                            <button
                                onClick={() => setShowComment(!showComment)}
                                style={{
                                    width: "52px",
                                    height: "52px",
                                    borderRadius: "50%",
                                    border: "2px solid rgba(255,255,255,0.2)",
                                    background: showComment
                                        ? "rgba(59,130,246,0.7)"
                                        : "rgba(255,255,255,0.06)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    backdropFilter: "blur(10px)",
                                    transition: "all 0.2s",
                                    alignSelf: "center",
                                }}
                            >
                                <MessageCircle size={20} color="white" />
                            </button>

                            {/* Map button */}
                            <button
                                onClick={() => setShowMap(!showMap)}
                                style={{
                                    width: "52px",
                                    height: "52px",
                                    borderRadius: "50%",
                                    border: "2px solid rgba(255,255,255,0.2)",
                                    background: showMap
                                        ? "rgba(34,197,94,0.7)"
                                        : "rgba(255,255,255,0.06)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    backdropFilter: "blur(10px)",
                                    transition: "all 0.2s",
                                    alignSelf: "center",
                                }}
                            >
                                <MapPinIcon size={20} color="white" />
                            </button>

                            {/* List button */}
                            <button
                                onClick={() => setShowList(!showList)}
                                style={{
                                    width: "52px",
                                    height: "52px",
                                    borderRadius: "50%",
                                    border: "2px solid rgba(255,255,255,0.2)",
                                    background: showList
                                        ? "rgba(34,197,94,0.7)"
                                        : "rgba(255,255,255,0.06)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    backdropFilter: "blur(10px)",
                                    transition: "all 0.2s",
                                    alignSelf: "center",
                                }}
                            >
                                <List size={20} color="white" />
                            </button>
                        </div>

                        {/* ─── Comment Drawer ─── */}
                        {showComment && (
                            <div style={{
                                position: "absolute",
                                bottom: "100px",
                                left: "16px",
                                right: "16px",
                                zIndex: 30,
                                background: "rgba(0,0,0,0.85)",
                                backdropFilter: "blur(20px)",
                                borderRadius: "16px",
                                padding: "16px",
                                border: "1px solid rgba(255,255,255,0.1)",
                                animation: "fadeInUp 0.3s ease-out",
                            }}>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    marginBottom: "10px",
                                }}>
                                    <MessageCircle size={14} color={accentColor} />
                                    <span style={{
                                        color: accentColor,
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        textTransform: "uppercase" as const,
                                        letterSpacing: "0.05em",
                                    }}>
                                        {pick(copy.writeComment)}
                                    </span>
                                    <button
                                        onClick={() => setShowComment(false)}
                                        style={{
                                            marginLeft: "auto",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: "4px",
                                        }}
                                    >
                                        <X size={14} color="rgba(255,255,255,0.5)" />
                                    </button>
                                </div>
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder={pick(copy.commentPlaceholder)}
                                    style={{
                                        width: "100%",
                                        minHeight: "60px",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "10px",
                                        padding: "10px 12px",
                                        color: "white",
                                        fontSize: "14px",
                                        resize: "none" as const,
                                        outline: "none",
                                        fontFamily: "inherit",
                                    }}
                                    maxLength={2000}
                                />
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginTop: "8px",
                                }}>
                                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>
                                        {commentText.length}/2000
                                    </span>
                                    <button
                                        onClick={handleSubmitComment}
                                        disabled={!commentText.trim() || isSubmittingComment}
                                        style={{
                                            background: commentText.trim() ? accentColor : "rgba(255,255,255,0.1)",
                                            border: "none",
                                            borderRadius: "20px",
                                            padding: "8px 20px",
                                            color: "white",
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            cursor: commentText.trim() ? "pointer" : "default",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            opacity: commentText.trim() ? 1 : 0.5,
                                        }}
                                    >
                                        <Send size={13} />
                                        {isSubmittingComment ? pick(copy.submitting) : pick(copy.submit)}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ─── Navigation Touch Zones ─── */}
                        <div
                            onClick={goPrev}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "30%",
                                height: "70%",
                                zIndex: 5,
                                cursor: currentIndex > 0 ? "pointer" : "default",
                            }}
                        />
                        <div
                            onClick={goNext}
                            style={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                width: "30%",
                                height: "70%",
                                zIndex: 5,
                                cursor: currentIndex < totalCards - 1 ? "pointer" : "default",
                            }}
                        />
                    </>
                )}
            </div>

            {/* ─── Map View Overlay ─── */}
            {showMap && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 100,
                    background: "#0a0a0a",
                    maxWidth: "430px",
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                }}>
                    {/* Map Header */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "rgba(0,0,0,0.95)",
                        zIndex: 10,
                        gap: "8px",
                    }}>
                        <button
                            onClick={() => {
                                setShowMap(false);
                                setShowRoute(false);
                                setRouteData(null);
                                clearRenderedRoute();
                            }}
                            style={{
                                background: "rgba(255,255,255,0.1)",
                                border: "none",
                                borderRadius: "20px",
                                padding: "8px 16px",
                                color: "white",
                                fontSize: "13px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            <ChevronDown size={14} />
                            {pick(copy.back)}
                        </button>

                        {/* ShowPlan button */}
                        <button
                            onClick={async () => {
                                if (showRoute) {
                                    setShowRoute(false);
                                    setRouteData(null);
                                    clearRenderedRoute();
                                    return;
                                }
                                const withCoords = cards.filter(c => c.type !== "welcome" && c.latitude && c.longitude);
                                if (withCoords.length < 2) {
                                    toast.error(pick(copy.needTwoListings));
                                    return;
                                }
                                setRouteLoading(true);
                                try {
                                    const map = mapInstanceRef.current;
                                    if (!map) {
                                        setRouteLoading(false);
                                        return;
                                    }

                                    const directionsService = new (window as any).google.maps.DirectionsService();
                                    const stops = withCoords.map(c => ({
                                        lat: c.latitude!,
                                        lng: c.longitude!,
                                    }));
                                    const origin = stops[0];
                                    const destination = stops[stops.length - 1];
                                    const waypoints = stops.slice(1, -1).map(s => ({
                                        location: s,
                                        stopover: true,
                                    }));
                                    directionsService.route({
                                        origin,
                                        destination,
                                        waypoints,
                                        optimizeWaypoints: true,
                                        travelMode: (window as any).google.maps.TravelMode.DRIVING,
                                    }, (result: any, status: string) => {
                                        if (status === "OK" && result) {
                                            // Render route on map
                                            clearRenderedRoute();
                                            const renderer = new (window as any).google.maps.DirectionsRenderer({
                                                map,
                                                directions: result,
                                                suppressMarkers: true,
                                                polylineOptions: {
                                                    strokeColor: "#3b82f6",
                                                    strokeWeight: 4,
                                                    strokeOpacity: 0.8,
                                                },
                                            });
                                            routeRendererRef.current = renderer;

                                            // Collect route data for summary
                                            const legs = result.routes[0].legs;
                                            let totalDuration = 0;
                                            let totalDistance = 0;
                                            const legSummaries = legs.map((leg: any) => ({
                                                durationText: leg.duration.text,
                                                distanceText: leg.distance.text,
                                                durationSeconds: leg.duration.value,
                                                distanceMeters: leg.distance.value,
                                            }));
                                            legs.forEach((leg: any) => {
                                                totalDuration += leg.duration.value;
                                                totalDistance += leg.distance.value;
                                            });
                                            setRouteData({
                                                totalDuration,
                                                totalDistance,
                                                stops: withCoords.length,
                                                legs: legSummaries,
                                            });
                                            setShowRoute(true);
                                        } else {
                                            toast.error(pick(copy.routeFailed));
                                        }
                                        setRouteLoading(false);
                                    });
                                } catch {
                                    toast.error(pick(copy.routeError));
                                    setRouteLoading(false);
                                }
                            }}
                            disabled={routeLoading}
                            style={{
                                background: showRoute ? "rgba(59,130,246,0.7)" : "rgba(255,255,255,0.1)",
                                border: "none",
                                borderRadius: "20px",
                                padding: "8px 14px",
                                color: "white",
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                                fontWeight: 600,
                                opacity: routeLoading ? 0.6 : 1,
                            }}
                        >
                            <Navigation size={13} />
                            {routeLoading ? pick(copy.routePlanning) : showRoute ? pick(copy.hideRoute) : pick(copy.showRoute)}
                        </button>

                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginLeft: "auto" }}>
                            {pick(copy.listingCount(cards.filter(c => c.type !== "welcome").length))}
                        </span>
                    </div>

                    {/* Map Container */}
                    <div
                        ref={mapContainerRef}
                        style={{ flex: 1, width: "100%", background: "#1a1a2e" }}
                    />

                    {/* Route Summary Bar */}
                    {showRoute && routeData && (
                        <div style={{
                            padding: "14px 16px",
                            background: "rgba(0,0,0,0.95)",
                            borderTop: "1px solid rgba(59,130,246,0.3)",
                        }}>
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "16px",
                                color: "white",
                                fontSize: "13px",
                                fontWeight: 600,
                            }}>
                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    🕐 {Math.round(routeData.totalDuration / 60)} min
                                </span>
                                <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    📍 {routeData.stops} {pick(copy.stops)}
                                </span>
                                <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    🚗 {(routeData.totalDistance / 1609.34).toFixed(1)} mi
                                </span>
                            </div>
                            {/* Leg breakdown */}
                            <div style={{
                                display: "flex",
                                gap: "6px",
                                marginTop: "8px",
                                overflowX: "auto",
                                paddingBottom: "2px",
                            }}>
                                {routeData.legs.map((leg: any, i: number) => (
                                    <div key={i} style={{
                                        background: "rgba(59,130,246,0.15)",
                                        borderRadius: "8px",
                                        padding: "4px 10px",
                                        fontSize: "11px",
                                        color: "rgba(255,255,255,0.7)",
                                        whiteSpace: "nowrap",
                                        border: "1px solid rgba(59,130,246,0.2)",
                                    }}>
                                        {leg.durationText} · {leg.distanceText}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── List View Overlay ─── */}
            {showList && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 100,
                    background: "#0a0a0a",
                    maxWidth: "430px",
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "rgba(0,0,0,0.95)",
                        zIndex: 10,
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                    }}>
                        <button
                            onClick={() => setShowList(false)}
                            style={{
                                background: "rgba(255,255,255,0.1)",
                                border: "none",
                                borderRadius: "20px",
                                padding: "8px 16px",
                                color: "white",
                                fontSize: "13px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            <ChevronDown size={14} />
                            {pick(copy.back)}
                        </button>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginLeft: "auto" }}>
                            {pick(copy.listingCount(cards.filter(c => c.type !== "welcome").length))}
                        </span>
                    </div>
                    <div style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "8px 12px",
                    }}>
                        {cards.filter(c => c.type !== "welcome").map((card, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    // Find the actual card index in original array
                                    const idx = cards.indexOf(card);
                                    if (idx >= 0) setCurrentIndex(idx);
                                    setShowList(false);
                                }}
                                style={{
                                    display: "flex",
                                    gap: "12px",
                                    padding: "12px",
                                    borderRadius: "12px",
                                    background: "rgba(255,255,255,0.04)",
                                    marginBottom: "8px",
                                    cursor: "pointer",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    transition: "background 0.2s",
                                }}
                            >
                                {/* Thumbnail */}
                                <div style={{
                                    width: "80px",
                                    height: "60px",
                                    borderRadius: "8px",
                                    background: card.image
                                        ? `url(${card.image}) center/cover`
                                        : "rgba(255,255,255,0.1)",
                                    flexShrink: 0,
                                }} />
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        color: accentColor,
                                        fontSize: "15px",
                                        fontWeight: 700,
                                    }}>
                                        {card.price || pick(copy.listPriceUnavailable)}
                                    </div>
                                    <div style={{
                                        color: "rgba(255,255,255,0.8)",
                                        fontSize: "12px",
                                        marginTop: "2px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}>
                                        {card.address}
                                    </div>
                                    <div style={{
                                        color: "rgba(255,255,255,0.4)",
                                        fontSize: "11px",
                                        marginTop: "3px",
                                    }}>
                                        {[card.beds && `${card.beds}bd`, card.baths && `${card.baths}ba`, card.sqft && `${card.sqft}sqft`]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Agent Profile Footer ─── */}
            {data.agentProfile && (data.agentProfile.phone || data.agentProfile.email || data.agentProfile.wechatId) && (
                <div style={{
                    position: "fixed",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    maxWidth: "430px",
                    margin: "0 auto",
                    zIndex: showMap ? 0 : 60,
                    background: "rgba(0,0,0,0.85)",
                    backdropFilter: "blur(20px)",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    animation: "fadeInUp 0.4s ease-out",
                }} ref={agentFooterRef}>
                    {/* Compact bar */}
                    <div
                        onClick={() => setShowAgentCard(!showAgentCard)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 16px",
                            cursor: "pointer",
                        }}
                    >
                        {/* Avatar */}
                        <div style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background: data.agentProfile.avatarUrl
                                ? `url(${data.agentProfile.avatarUrl}) center/cover`
                                : `linear-gradient(135deg, ${accentColor}, ${accentColor}88)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            fontSize: "16px",
                            fontWeight: 700,
                            color: "white",
                        }}>
                            {!data.agentProfile.avatarUrl && (data.agentName || "A")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: "white", fontSize: "14px", fontWeight: 600 }}>
                                {data.agentName}
                            </div>
                            {data.agentProfile.title && (
                                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
                                    {data.agentProfile.title}
                                </div>
                            )}
                        </div>
                        <ChevronDown
                            size={16}
                            color="rgba(255,255,255,0.4)"
                            style={{
                                transform: showAgentCard ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s",
                            }}
                        />
                    </div>

                    {/* Expanded card */}
                    {showAgentCard && (
                        <div style={{
                            padding: "0 16px 14px",
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            animation: "fadeInUp 0.2s ease-out",
                        }}>
                            {data.agentProfile.phone && (
                                <a
                                    href={`tel:${data.agentProfile.phone}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        background: "rgba(255,255,255,0.08)",
                                        borderRadius: "20px",
                                        padding: "6px 14px",
                                        color: "white",
                                        fontSize: "12px",
                                        textDecoration: "none",
                                    }}
                                >
                                    <PhoneIcon size={12} color={accentColor} />
                                    {data.agentProfile.phone}
                                </a>
                            )}
                            {data.agentProfile.email && (
                                <a
                                    href={`mailto:${data.agentProfile.email}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        background: "rgba(255,255,255,0.08)",
                                        borderRadius: "20px",
                                        padding: "6px 14px",
                                        color: "white",
                                        fontSize: "12px",
                                        textDecoration: "none",
                                    }}
                                >
                                    <MailIcon size={12} color={accentColor} />
                                    {data.agentProfile.email}
                                </a>
                            )}
                            {data.agentProfile.wechatId && (
                                <div
                                    onClick={() => {
                                        navigator.clipboard.writeText(data.agentProfile!.wechatId!);
                                        toast.success(pick(copy.wechatCopied));
                                    }}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        background: "rgba(255,255,255,0.08)",
                                        borderRadius: "20px",
                                        padding: "6px 14px",
                                        color: "white",
                                        fontSize: "12px",
                                        cursor: "pointer",
                                    }}
                                >
                                    💬 {pick(copy.wechatPrefix)}: {data.agentProfile.wechatId}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

export default SmartMatchStory;
