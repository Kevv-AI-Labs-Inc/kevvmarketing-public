# TODOS

## P1 — Do before Phase 1

### Schema migration strategy cleanup
**What:** Standardize all table creation on Drizzle schema + `drizzle-kit push`. Remove runtime `CREATE TABLE IF NOT EXISTS` patterns (e.g., `smartMatchRouter.ts:67`).
**Why:** Mixed migration strategies cause schema drift. New prospecting tables should follow one consistent pattern.
**Effort:** S (human: ~2 days / CC: ~1h)
**Depends on:** Nothing

### BBO listing history endpoint (cross-project dependency)
**What:** Add `GET /listing/:id/history` to the BBO Listing Data Service. Returns price changes, status changes (active→pending→withdrawn→expired), DOM timeline, relist chain. The prospecting briefEngine calls this to diagnose why a listing expired.
**Why:** Without listing history, the brief's diagnosis is based only on price delta and DOM — thin evidence. Full history enables accurate failure diagnosis and better pitch angles.
**Effort:** S (human: ~2 days / CC: ~1h)
**Depends on:** BBO repo (`/Users/weizhengle/Downloads/vibecoding/BBO`). Can be built in parallel with Phase 1. briefEngine degrades gracefully if endpoint not available.

### BBO comparable sales endpoint (cross-project dependency)
**What:** Add `GET /listing/:id/comparables` to the BBO Listing Data Service. Returns recent closed sales within radius, matching property type, with price/sqft and DOM. The prospecting briefEngine uses this for the comp snapshot in briefs.
**Why:** Codex review found that the existing `valuationEngine.ts` generates heuristic estimates, not actual MLS comps. Using fabricated data for expired-listing diagnosis undermines pitch credibility. BBO has full MLSGrid data including closed sales.
**Effort:** S (human: ~2 days / CC: ~1h)
**Depends on:** BBO repo (`/Users/weizhengle/Downloads/vibecoding/BBO`). Can be built in parallel with Phase 1. briefEngine degrades gracefully if endpoint not available (notes "comps unavailable").

### Normalize service areas to ZIP codes
**What:** When an agent enters a city name (e.g., "San Francisco") as a service area, expand it to the component ZIP codes (94102, 94103, ..., 94134) at save time. Store only ZIPs in `agentProfiles.serviceAreas`. Display the city name as a label in the UI but filter on ZIPs.
**Why:** Current flat string[] mixes city names and ZIP codes. "94110" is inside "San Francisco" but the system doesn't know that. Prospecting farm area filtering (Phase 2) will produce wrong results without normalization.
**Effort:** S (human: ~2 days / CC: ~1h). Needs a city→ZIP lookup table or API.
**Depends on:** Nothing. Can be done before or during Phase 2.

## P2 — Do before Phase 3

### Call recording consent compliance
**What:** Add a state-level consent disclaimer or check before agents upload call recordings. Two-party consent states (CA, FL, IL, etc.) require all parties to consent to recording.
**Why:** Legal liability. Platform should at minimum show a disclaimer; ideally check agent's state and warn.
**Effort:** S (human: ~2 days / CC: ~1h)
**Depends on:** Phase 3 starting
