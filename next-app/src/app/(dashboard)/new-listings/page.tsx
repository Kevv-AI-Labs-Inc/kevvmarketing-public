import { getCachedNewListings } from "@/server/mls/listingCache";
import NewListingsDashboard from "@/components/listings/new-listings-dashboard";

/**
 * New Listings — ISR-powered server component.
 *
 * Data flow:
 *  1. Next.js calls getCachedNewListings() at build / revalidation time
 *  2. unstable_cache stores the BBO response for 5 minutes
 *  3. ISR serves cached HTML instantly to users (revalidate = 300)
 *  4. Client component handles time-range filtering and interactivity
 *
 * Result: BBO gets ~12 API calls/hour instead of 1-per-pageview.
 *         Users see fully rendered HTML + optimized images on first paint.
 */
export const revalidate = 300; // 5 minutes ISR

export default async function NewListingsPage() {
  const listings = await getCachedNewListings(60);

  return <NewListingsDashboard initialListings={listings} />;
}
