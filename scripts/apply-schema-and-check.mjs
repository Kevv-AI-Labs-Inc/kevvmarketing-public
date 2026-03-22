/**
 * Script to apply schema changes and verify MLS coordinate data.
 * Run with: railway run node scripts/apply-schema-and-check.mjs
 */
import pg from "pg";

const { Client } = pg;

async function main() {
    const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
    if (!databaseUrl) {
        console.error("No DATABASE_URL found");
        process.exit(1);
    }

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    console.log("✅ Connected to database");

    // 1. Create pgvector extension
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    console.log("✅ pgvector extension ready");

    // 2. Create missing tables
    const createStatements = [
        // members table
        `CREATE TABLE IF NOT EXISTS "members" (
      "id" serial PRIMARY KEY,
      "memberKey" varchar(64) NOT NULL UNIQUE,
      "memberKeyNumeric" varchar(32),
      "memberFirstName" varchar(128),
      "memberLastName" varchar(128),
      "memberEmail" varchar(320),
      "memberPreferredPhone" varchar(32),
      "officeName" varchar(256),
      "memberStatus" varchar(32),
      "memberType" varchar(32),
      "modificationTimestamp" timestamp,
      "originatingSystemName" varchar(64),
      "rawData" text,
      "embeddingGemini" vector(3072),
      "embeddingGeminiModel" varchar(64),
      "embeddingOpenai" vector(3072),
      "embeddingOpenaiModel" varchar(64),
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`,
        // offices table
        `CREATE TABLE IF NOT EXISTS "offices" (
      "id" serial PRIMARY KEY,
      "officeKey" varchar(64) NOT NULL UNIQUE,
      "officeKeyNumeric" varchar(32),
      "officeName" varchar(256),
      "officePhone" varchar(32),
      "officeEmail" varchar(320),
      "officeAddress1" varchar(256),
      "officeCity" varchar(128),
      "officeStateOrProvince" varchar(32),
      "officePostalCode" varchar(16),
      "officeStatus" varchar(32),
      "officeType" varchar(32),
      "modificationTimestamp" timestamp,
      "originatingSystemName" varchar(64),
      "rawData" text,
      "embeddingGemini" vector(3072),
      "embeddingGeminiModel" varchar(64),
      "embeddingOpenai" vector(3072),
      "embeddingOpenaiModel" varchar(64),
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`,
        // open_houses table
        `CREATE TABLE IF NOT EXISTS "open_houses" (
      "id" serial PRIMARY KEY,
      "openHouseKey" varchar(64) NOT NULL UNIQUE,
      "listingKey" varchar(64),
      "listingId" varchar(64),
      "openHouseDate" timestamp,
      "openHouseStartTime" varchar(16),
      "openHouseEndTime" varchar(16),
      "openHouseRemarks" text,
      "openHouseStatus" varchar(32),
      "openHouseType" varchar(32),
      "showingAgentFirstName" varchar(128),
      "showingAgentLastName" varchar(128),
      "modificationTimestamp" timestamp,
      "originatingSystemName" varchar(64),
      "rawData" text,
      "embeddingGemini" vector(3072),
      "embeddingGeminiModel" varchar(64),
      "embeddingOpenai" vector(3072),
      "embeddingOpenaiModel" varchar(64),
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`,
        // deal_stories table
        `CREATE TABLE IF NOT EXISTS "deal_stories" (
      "id" serial PRIMARY KEY,
      "listingKey" varchar(64) NOT NULL,
      "clientId" varchar(64),
      "agentId" varchar(64),
      "storyType" varchar(32),
      "storyContent" text,
      "embeddingGemini" vector(3072),
      "embeddingGeminiModel" varchar(64),
      "embeddingOpenai" vector(3072),
      "embeddingOpenaiModel" varchar(64),
      "embeddingOpenaiSearch" vector(1536),
      "embeddingOpenaiSearchModel" varchar(64),
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`,
        // neighborhoods table
        `CREATE TABLE IF NOT EXISTS "neighborhoods" (
      "id" serial PRIMARY KEY,
      "name" varchar(256) NOT NULL UNIQUE,
      "city" varchar(128),
      "stateOrProvince" varchar(32),
      "description" text,
      "embeddingGemini" vector(3072),
      "embeddingGeminiModel" varchar(64),
      "embeddingOpenai" vector(3072),
      "embeddingOpenaiModel" varchar(64),
      "embeddingOpenaiSearch" vector(1536),
      "embeddingOpenaiSearchModel" varchar(64),
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`,
        // showing_feedback table
        `CREATE TABLE IF NOT EXISTS "showing_feedback" (
      "id" serial PRIMARY KEY,
      "listingKey" varchar(64) NOT NULL,
      "clientId" varchar(64),
      "agentId" varchar(64),
      "rating" integer,
      "feedback" text,
      "feedbackType" varchar(32),
      "embeddingGemini" vector(3072),
      "embeddingGeminiModel" varchar(64),
      "embeddingOpenai" vector(3072),
      "embeddingOpenaiModel" varchar(64),
      "embeddingOpenaiSearch" vector(1536),
      "embeddingOpenaiSearchModel" varchar(64),
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )`,
    ];

    // Add missing columns to properties
    const alterStatements = [
        `ALTER TABLE IF EXISTS "properties" ADD COLUMN IF NOT EXISTS "roomsSummary" text`,
        `ALTER TABLE IF EXISTS "properties" ADD COLUMN IF NOT EXISTS "unitTypesSummary" text`,
        // Add missing embedding columns to agent_profiles and client_profiles
        `ALTER TABLE IF EXISTS "agent_profiles" ADD COLUMN IF NOT EXISTS "embeddingGemini" vector(3072)`,
        `ALTER TABLE IF EXISTS "agent_profiles" ADD COLUMN IF NOT EXISTS "embeddingGeminiModel" varchar(64)`,
        `ALTER TABLE IF EXISTS "agent_profiles" ADD COLUMN IF NOT EXISTS "embeddingOpenai" vector(3072)`,
        `ALTER TABLE IF EXISTS "agent_profiles" ADD COLUMN IF NOT EXISTS "embeddingOpenaiModel" varchar(64)`,
        `ALTER TABLE IF EXISTS "client_profiles" ADD COLUMN IF NOT EXISTS "embeddingGemini" vector(3072)`,
        `ALTER TABLE IF EXISTS "client_profiles" ADD COLUMN IF NOT EXISTS "embeddingGeminiModel" varchar(64)`,
        `ALTER TABLE IF EXISTS "client_profiles" ADD COLUMN IF NOT EXISTS "embeddingOpenai" vector(3072)`,
        `ALTER TABLE IF EXISTS "client_profiles" ADD COLUMN IF NOT EXISTS "embeddingOpenaiModel" varchar(64)`,

        // ── Fix members table: add columns expected by Drizzle schema ──
        `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberMlsId" varchar(255)`,
        `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "officeKey" varchar(255)`,
        `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberStateLicense" varchar(100)`,
        `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberNationalAssociationId" varchar(100)`,
        `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberFullName" varchar(255)`,
        `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberMobilePhone" varchar(50)`,
        `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberDirectPhone" varchar(50)`,
        `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "mediaURL" text`,
        `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberLastName" varchar(100)`,

        // ── Fix offices table: add columns expected by Drizzle schema ──
        `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "officeMlsId" varchar(255)`,
        `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "officeLatitude" varchar(20)`,
        `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "officeLongitude" varchar(20)`,
        `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "mediaURL" text`,

        // ── Fix open_houses table: add columns expected by Drizzle schema ──
        `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "appointmentRequired" integer`,
        `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "remarks" text`,
        `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "openHouseStartTime" timestamp`,
        `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "openHouseEndTime" timestamp`,
    ];

    for (const sql of createStatements) {
        try {
            await client.query(sql);
            const tableName = sql.match(/"(\w+)"/)?.[1];
            console.log(`✅ Table "${tableName}" ready`);
        } catch (err) {
            console.warn(`⚠️  Table creation issue: ${err.message}`);
        }
    }

    for (const sql of alterStatements) {
        try {
            await client.query(sql);
            const colMatch = sql.match(/ADD COLUMN IF NOT EXISTS "(\w+)"/);
            const tblMatch = sql.match(/"(\w+)" ADD/);
            console.log(`✅ Column "${tblMatch?.[1]}.${colMatch?.[1]}" ready`);
        } catch (err) {
            console.warn(`⚠️  Column issue: ${err.message}`);
        }
    }

    // 3. Verify coordinate data
    console.log("\n─── MLS Coordinate Data Verification ───");

    const totalRes = await client.query("SELECT COUNT(*) as count FROM properties");
    console.log(`Total properties: ${totalRes.rows[0].count}`);

    const latNotNullRes = await client.query(
        "SELECT COUNT(*) as count FROM properties WHERE latitude IS NOT NULL AND latitude != ''"
    );
    console.log(`Properties with latitude (non-null, non-empty): ${latNotNullRes.rows[0].count}`);

    const lngNotNullRes = await client.query(
        "SELECT COUNT(*) as count FROM properties WHERE longitude IS NOT NULL AND longitude != ''"
    );
    console.log(`Properties with longitude (non-null, non-empty): ${lngNotNullRes.rows[0].count}`);

    const bothRes = await client.query(
        "SELECT COUNT(*) as count FROM properties WHERE latitude IS NOT NULL AND latitude != '' AND longitude IS NOT NULL AND longitude != ''"
    );
    console.log(`Properties with both lat+lng: ${bothRes.rows[0].count}`);

    const zeroRes = await client.query(
        "SELECT COUNT(*) as count FROM properties WHERE latitude = '0' OR longitude = '0'"
    );
    console.log(`Properties with lat=0 or lng=0: ${zeroRes.rows[0].count}`);

    // Sample some coordinates
    const sampleRes = await client.query(
        `SELECT "listingKey", latitude, longitude, city, "unparsedAddress"
     FROM properties
     WHERE latitude IS NOT NULL AND latitude != '' AND latitude != '0'
     LIMIT 5`
    );
    if (sampleRes.rows.length > 0) {
        console.log("\nSample coordinates:");
        for (const row of sampleRes.rows) {
            console.log(`  ${row.listingKey}: lat=${row.latitude}, lng=${row.longitude} (${row.city} - ${row.unparsedAddress})`);
        }
    } else {
        console.log("\n⚠️  No properties have valid coordinates");
    }

    // 4. Check table counts
    console.log("\n─── Table Counts ───");
    for (const table of ["properties", "media", "members", "offices", "open_houses", "users", "sync_log"]) {
        try {
            const res = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
            console.log(`  ${table}: ${res.rows[0].count} rows`);
        } catch {
            console.log(`  ${table}: (doesn't exist)`);
        }
    }

    await client.end();
    console.log("\n✅ Done");
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
