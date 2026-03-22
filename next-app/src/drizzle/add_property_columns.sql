-- Safe migration: add ALL new RESO Property columns to properties table
-- Run this directly on the Railway Postgres database
-- All columns are nullable, so no data loss or conflicts

-- ── Descriptions & Remarks ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "privateRemarks" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "syndicationRemarks" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "showingInstructions" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "listingTerms" varchar(500);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "disclosures" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "ownership" varchar(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "specialListingConditions" varchar(255);

-- ── Dates & Market ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "originalEntryTimestamp" timestamp;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "onMarketDate" timestamp;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "statusChangeTimestamp" timestamp;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "daysOnMarket" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "cumulativeDaysOnMarket" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "expirationDate" timestamp;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "mlsStatus" varchar(50);

-- ── Location Extended ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "countyOrParish" varchar(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "directions" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "crossStreet" varchar(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "subdivisionName" varchar(255);

-- ── Property Details Extended ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "propertySubType" varchar(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "architecturalStyle" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "constructionMaterials" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "yearBuilt" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "yearBuiltEffective" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "newConstructionYN" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "propertyCondition" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "stories" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "levels" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "bathroomsFull" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "bathroomsHalf" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "roomsTotal" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "aboveGradeFinishedArea" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "belowGradeFinishedArea" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "buildingAreaTotal" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "roof" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "foundationDetails" varchar(255);

-- ── Lot & Land ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "lotSizeArea" varchar(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "lotSizeUnits" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "lotSizeSquareFeet" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "lotSizeAcres" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "lotFeatures" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "zoning" varchar(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "zoningDescription" varchar(500);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "parcelNumber" varchar(50);

-- ── Parking & Garage ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "garageSpaces" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "garageYN" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "parkingFeatures" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "parkingTotal" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "attachedGarageYN" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "carportSpaces" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "openParkingSpaces" integer;

-- ── Interior Features ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "heating" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "cooling" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "flooring" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "appliances" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "interiorFeatures" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "laundryFeatures" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "fireplaceYN" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "fireplacesTotal" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "fireplaceFeatures" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "windowFeatures" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "securityFeatures" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "basement" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "basementYN" integer;

-- ── Exterior & Landscape ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "exteriorFeatures" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "fencing" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "patioAndPorchFeatures" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "poolFeatures" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "poolPrivateYN" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "spaYN" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "spaFeatures" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "waterfrontYN" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "waterfrontFeatures" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "waterBodyName" varchar(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "view" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "greenEnergyEfficient" varchar(255);

-- ── Utilities ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "utilities" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "waterSource" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "sewer" varchar(255);

-- ── Price & Fees Extended ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "originalListPrice" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "closePrice" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "associationFee" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "associationFeeFrequency" varchar(25);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "associationYN" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "associationName" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "taxAnnualAmount" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "taxYear" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "taxAssessedValue" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "buyerFinancing" varchar(255);

-- ── Schools & Community ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "elementarySchool" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "middleOrJuniorSchool" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "highSchool" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "elementarySchoolDistrict" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "highSchoolDistrict" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "communityFeatures" text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "seniorCommunityYN" integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "numberOfUnitsTotal" integer;

-- ── Agent & Office ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "listAgentKey" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "listAgentMlsId" varchar(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "listAgentFullName" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "listOfficeName" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "buyerAgentKey" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "buyerAgentFullName" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "buyerOfficeName" varchar(255);

-- ── Closing ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "closeDate" timestamp;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "purchaseContractDate" timestamp;

-- ── Showing ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "showingContactPhone" varchar(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "lockBoxType" varchar(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "accessCode" varchar(50);

-- ── Rental / Lease ──
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "petsAllowed" varchar(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "availabilityDate" timestamp;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "rentIncludes" varchar(500);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "tenantPays" varchar(500);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "leaseTerm" varchar(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "possessionDate" timestamp;

SELECT 'All property columns added successfully!' AS result;
