import { PrismaClient } from "@repo/db";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Limit connection pool size for serverless environment
});

const cachedPrisma = globalForPrisma.prisma;
const hasAutoAssignmentDelegate = Boolean(
  (cachedPrisma as any)?.autoAssignmentSchedule,
);
const hasStudentAssignmentAttemptDelegate = Boolean(
  (cachedPrisma as any)?.studentAssignmentAttempt,
);
const hasAttemptSchemaFields = (() => {
  const fields = (cachedPrisma as any)?._runtimeDataModel?.models?.StudentAssignment
    ?.fields;

  if (!Array.isArray(fields)) {
    return false;
  }

  const fieldNames = new Set(
    fields
      .map((field: { name?: unknown }) => field?.name)
      .filter((name): name is string => typeof name === "string"),
  );

  return (
    fieldNames.has("latestSubmittedAt") &&
    fieldNames.has("attemptCount") &&
    fieldNames.has("correctAttemptCount")
  );
})();
const hasCompatibleSchema =
  hasAutoAssignmentDelegate &&
  hasStudentAssignmentAttemptDelegate &&
  hasAttemptSchemaFields;

const prisma =
  !cachedPrisma || !hasCompatibleSchema
    ? new PrismaClient({
        adapter,
      })
    : cachedPrisma;

// Cache globally in ALL environments to prevent exhausting DB connections
// In serverless (Vercel), this reuses the client within the same cold-start instance
globalForPrisma.prisma = prisma;

export default prisma;
