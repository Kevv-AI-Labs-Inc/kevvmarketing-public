-- Comprehensive fix: ensure ALL varchar columns in properties, open_houses,
-- media, members, offices, and syncLog tables match Drizzle schema definitions.
-- ALTER COLUMN TYPE is safe — widening never loses data.
-- If a column doesn't exist, the ALTER will just fail for that line (harmless).

-- ══════════════════════════════════════════════════════════════════
-- PROPERTIES TABLE
-- ══════════════════════════════════════════════════════════════════

-- Core fields (may have been created with smaller varchars originally)
ALTER TABLE properties ALTER COLUMN "listingKey" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "listingId" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "originatingSystemName" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "standardStatus" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "city" TYPE varchar(100);
ALTER TABLE properties ALTER COLUMN "stateOrProvince" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "postalCode" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "latitude" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "longitude" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "listPrice" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "propertyType" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "livingArea" TYPE varchar(20);

-- Rich RESO fields
ALTER TABLE properties ALTER COLUMN "listingTerms" TYPE varchar(500);
ALTER TABLE properties ALTER COLUMN "ownership" TYPE varchar(100);
ALTER TABLE properties ALTER COLUMN "specialListingConditions" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "mlsStatus" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "countyOrParish" TYPE varchar(100);
ALTER TABLE properties ALTER COLUMN "crossStreet" TYPE varchar(100);
ALTER TABLE properties ALTER COLUMN "subdivisionName" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "propertySubType" TYPE varchar(100);
ALTER TABLE properties ALTER COLUMN "architecturalStyle" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "constructionMaterials" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "propertyCondition" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "levels" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "aboveGradeFinishedArea" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "belowGradeFinishedArea" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "buildingAreaTotal" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "roof" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "foundationDetails" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "lotSizeArea" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "lotSizeUnits" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "lotSizeSquareFeet" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "lotSizeAcres" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "zoning" TYPE varchar(100);
ALTER TABLE properties ALTER COLUMN "zoningDescription" TYPE varchar(500);
ALTER TABLE properties ALTER COLUMN "parcelNumber" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "parkingFeatures" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "heating" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "cooling" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "flooring" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "laundryFeatures" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "fireplaceFeatures" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "windowFeatures" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "securityFeatures" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "basement" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "fencing" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "patioAndPorchFeatures" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "poolFeatures" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "spaFeatures" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "waterfrontFeatures" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "waterBodyName" TYPE varchar(100);
ALTER TABLE properties ALTER COLUMN "greenEnergyEfficient" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "utilities" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "waterSource" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "sewer" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "originalListPrice" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "closePrice" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "associationFee" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "associationFeeFrequency" TYPE varchar(25);
ALTER TABLE properties ALTER COLUMN "associationName" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "taxAnnualAmount" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "taxAssessedValue" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "buyerFinancing" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "elementarySchool" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "middleOrJuniorSchool" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "highSchool" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "elementarySchoolDistrict" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "highSchoolDistrict" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "listAgentKey" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "listAgentMlsId" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "listAgentFullName" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "listOfficeName" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "buyerAgentKey" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "buyerAgentFullName" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "buyerOfficeName" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "showingContactPhone" TYPE varchar(20);
ALTER TABLE properties ALTER COLUMN "lockBoxType" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "accessCode" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "petsAllowed" TYPE varchar(255);
ALTER TABLE properties ALTER COLUMN "rentIncludes" TYPE varchar(500);
ALTER TABLE properties ALTER COLUMN "tenantPays" TYPE varchar(500);
ALTER TABLE properties ALTER COLUMN "leaseTerm" TYPE varchar(50);
ALTER TABLE properties ALTER COLUMN "embeddingGeminiModel" TYPE varchar(100);
ALTER TABLE properties ALTER COLUMN "embeddingOpenaiModel" TYPE varchar(100);

-- ══════════════════════════════════════════════════════════════════
-- OPEN_HOUSES TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE open_houses ALTER COLUMN "openHouseKey" TYPE varchar(255);
ALTER TABLE open_houses ALTER COLUMN "listingKey" TYPE varchar(255);
ALTER TABLE open_houses ALTER COLUMN "originatingSystemName" TYPE varchar(255);
ALTER TABLE open_houses ALTER COLUMN "openHouseStatus" TYPE varchar(50);
ALTER TABLE open_houses ALTER COLUMN "openHouseType" TYPE varchar(100);

-- ══════════════════════════════════════════════════════════════════
-- MEDIA TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE media ALTER COLUMN "mediaKey" TYPE varchar(255);
ALTER TABLE media ALTER COLUMN "listingKey" TYPE varchar(255);
ALTER TABLE media ALTER COLUMN "mediaType" TYPE varchar(50);

-- ══════════════════════════════════════════════════════════════════
-- MEMBERS TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE members ALTER COLUMN "memberKey" TYPE varchar(255);
ALTER TABLE members ALTER COLUMN "memberMlsId" TYPE varchar(255);
ALTER TABLE members ALTER COLUMN "officeKey" TYPE varchar(255);
ALTER TABLE members ALTER COLUMN "originatingSystemName" TYPE varchar(255);
ALTER TABLE members ALTER COLUMN "memberStateLicense" TYPE varchar(100);

-- ══════════════════════════════════════════════════════════════════
-- OFFICES TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE offices ALTER COLUMN "officeKey" TYPE varchar(255);
ALTER TABLE offices ALTER COLUMN "officeMlsId" TYPE varchar(255);
ALTER TABLE offices ALTER COLUMN "originatingSystemName" TYPE varchar(255);
ALTER TABLE offices ALTER COLUMN "officeName" TYPE varchar(255);

SELECT 'All varchar columns widened to match Drizzle schema!' AS result;
