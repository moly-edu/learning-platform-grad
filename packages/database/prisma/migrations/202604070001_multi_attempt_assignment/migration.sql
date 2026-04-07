ALTER TABLE "student_assignment"
ADD COLUMN "latestSubmissionData" JSONB,
ADD COLUMN "latestSubmittedAt" TIMESTAMP(3),
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "correctAttemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "student_assignment_attempt" (
  "id" TEXT NOT NULL,
  "studentAssignmentId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "submissionData" JSONB NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_assignment_attempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_assignment_attempt_studentAssignmentId_attemptNumber_key"
ON "student_assignment_attempt"("studentAssignmentId", "attemptNumber");

CREATE INDEX "student_assignment_attempt_studentAssignmentId_submittedAt_idx"
ON "student_assignment_attempt"("studentAssignmentId", "submittedAt");

ALTER TABLE "student_assignment_attempt"
ADD CONSTRAINT "student_assignment_attempt_studentAssignmentId_fkey"
FOREIGN KEY ("studentAssignmentId") REFERENCES "student_assignment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "student_assignment"
SET
  "latestSubmissionData" = "submissionData",
  "latestSubmittedAt" = "submittedAt",
  "attemptCount" = CASE
    WHEN "submissionData" IS NULL THEN 0
    ELSE 1
  END,
  "correctAttemptCount" = CASE
    WHEN "submissionData" IS NULL THEN 0
    WHEN COALESCE(("submissionData"->'evaluation'->>'isCorrect')::boolean, false) THEN 1
    ELSE 0
  END;

INSERT INTO "student_assignment_attempt" (
  "id",
  "studentAssignmentId",
  "attemptNumber",
  "submissionData",
  "isCorrect",
  "submittedAt",
  "createdAt"
)
SELECT
  CONCAT('legacy_', MD5("id" || '-1')),
  "id",
  1,
  "submissionData",
  COALESCE(("submissionData"->'evaluation'->>'isCorrect')::boolean, false),
  COALESCE("submittedAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "student_assignment"
WHERE "submissionData" IS NOT NULL
ON CONFLICT ("studentAssignmentId", "attemptNumber") DO NOTHING;
