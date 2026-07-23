# TODOS

## P1 — Do before Phase 1

### Schema migration strategy cleanup
**What:** Standardize all table creation on Drizzle migrations. Remove runtime `CREATE TABLE IF NOT EXISTS` patterns still present in `shareRouter.ts`.
**Why:** Mixed migration strategies cause schema drift. New prospecting tables should follow one consistent pattern.
**Effort:** S (human: ~2 days / CC: ~1h)
**Depends on:** Nothing

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
