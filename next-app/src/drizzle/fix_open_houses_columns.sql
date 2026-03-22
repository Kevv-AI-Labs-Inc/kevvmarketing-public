-- Fix open_houses varchar columns that are too small (varchar(16))
-- Align DB with Drizzle schema definitions

ALTER TABLE open_houses ALTER COLUMN "openHouseKey" TYPE varchar(255);
ALTER TABLE open_houses ALTER COLUMN "listingKey" TYPE varchar(255);
ALTER TABLE open_houses ALTER COLUMN "originatingSystemName" TYPE varchar(255);
ALTER TABLE open_houses ALTER COLUMN "openHouseStatus" TYPE varchar(50);
ALTER TABLE open_houses ALTER COLUMN "openHouseType" TYPE varchar(100);
