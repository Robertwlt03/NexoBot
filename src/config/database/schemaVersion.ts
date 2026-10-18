/**
 * Schema versions shipped with this code. v1 is the baseline (tables in utils/database/schema.ts);
 * every later version has its SQL in `migrationStatements` there and is applied in order.
 * Never rename or remove an entry: the labels are recorded in the schema_migrations ledger.
 */
export const SCHEMA_VERSIONS: readonly { version: number; label: string }[] = [
    { version: 1, label: 'baseline-v1' },
    { version: 2, label: 'guild-daily-stats' },
    { version: 3, label: 'insights-detail' },
];

const LATEST_SCHEMA_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].version;

const rawSchemaVersion = Number.parseInt(process.env.SCHEMA_VERSION || '1', 10);
const pinnedSchemaVersion = Number.isInteger(rawSchemaVersion) && rawSchemaVersion > 0 ? rawSchemaVersion : 1;

// SCHEMA_VERSION used to pin the expected version (`.env.example` still says 1). A lower pin than the code ships
// would block every new migration, so the code's latest version wins; a higher pin still fails the check (code too old).
export const EXPECTED_SCHEMA_VERSION = Math.max(pinnedSchemaVersion, LATEST_SCHEMA_VERSION);

export const EXPECTED_SCHEMA_LABEL =
    (pinnedSchemaVersion === EXPECTED_SCHEMA_VERSION ? process.env.SCHEMA_VERSION_LABEL : undefined)
    || SCHEMA_VERSIONS.find((entry) => entry.version === EXPECTED_SCHEMA_VERSION)?.label
    || `baseline-v${EXPECTED_SCHEMA_VERSION}`;

/** Versions after `current` up to the expected one, in order (the ones a migration run still has to apply). */
export function pendingSchemaVersions(current: number): { version: number; label: string }[] {
    return SCHEMA_VERSIONS.filter((entry) => entry.version > current && entry.version <= EXPECTED_SCHEMA_VERSION);
}
