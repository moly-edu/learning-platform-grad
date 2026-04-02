import prisma from "@/lib/prisma";

type AssignmentSourceValue = "teacher" | "system";
type IntervalUnitValue = "minute" | "hour" | "day";

type CreateStudentAssignmentsInput = {
  assignmentId: string;
  studentIds: string[];
  source: AssignmentSourceValue;
  scheduleId?: string | null;
  rootAssignmentId?: string | null;
  reviewDueAt?: Date | null;
};

type AutoScheduleSnapshot = {
  id: string;
  classId: string;
  homeworkNodeId: string;
  startAt: Date;
  intervalValue: number;
  intervalUnit: IntervalUnitValue;
  decayFactor: number;
  minAutoNew: number;
  initialReviewDelayMinutes: number;
  maxRetryPerRoot: number;
  isActive: boolean;
  lastAutoRunAt: Date | null;
  runCount: number;
};

type AutoRunSummary = {
  scheduleId: string;
  manualAssignmentsInWindow: number;
  autoNewCreated: number;
  retryCreated: number;
  skipped: number;
};

function getAutoScheduleDelegate() {
  return (prisma as any).autoAssignmentSchedule as
    | {
        findFirst: (args: any) => Promise<any>;
        findMany: (args: any) => Promise<any[]>;
        findUnique: (args: any) => Promise<any>;
        update: (args: any) => Promise<any>;
      }
    | undefined;
}

function getDefaultIntervalUnit(): IntervalUnitValue {
  const raw = process.env.AUTO_ASSIGN_DEFAULT_INTERVAL_UNIT;
  if (raw === "minute" || raw === "hour" || raw === "day") return raw;

  return process.env.NODE_ENV === "production" ? "day" : "minute";
}

function toPositiveInt(value: string | undefined, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function toNonNegativeFloat(value: string | undefined, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function getDefaultScheduleConfig() {
  const isProd = process.env.NODE_ENV === "production";

  return {
    intervalValue: toPositiveInt(
      process.env.AUTO_ASSIGN_DEFAULT_INTERVAL_VALUE,
      isProd ? 2 : 2,
    ),
    intervalUnit: getDefaultIntervalUnit(),
    decayFactor: toNonNegativeFloat(
      process.env.AUTO_ASSIGN_DEFAULT_DECAY_FACTOR,
      0.5,
    ),
    minAutoNew: toPositiveInt(process.env.AUTO_ASSIGN_DEFAULT_MIN_AUTO_NEW, 1),
    initialReviewDelayMinutes: toPositiveInt(
      process.env.AUTO_ASSIGN_DEFAULT_REVIEW_DELAY_MINUTES,
      isProd ? 24 * 60 : 5,
    ),
    maxRetryPerRoot: toPositiveInt(
      process.env.AUTO_ASSIGN_DEFAULT_MAX_RETRY_PER_ROOT,
      6,
    ),
  };
}

const MAX_REVIEW_DELAY_MINUTES = 14 * 24 * 60;

function intervalUnitToMs(value: number, unit: IntervalUnitValue) {
  const safeValue = Math.max(1, value);
  if (unit === "minute") return safeValue * 60 * 1000;
  if (unit === "hour") return safeValue * 60 * 60 * 1000;
  return safeValue * 24 * 60 * 60 * 1000;
}

function getInitialReviewDueAt(initialReviewDelayMinutes: number) {
  const safeMinutes = Math.max(1, initialReviewDelayMinutes);
  return new Date(Date.now() + safeMinutes * 60 * 1000);
}

function getNextRetryDueAt(
  initialReviewDelayMinutes: number,
  retriesAlready: number,
) {
  const safeBase = Math.max(1, initialReviewDelayMinutes);
  const multiplier = 2 ** Math.max(0, retriesAlready);
  const delayMinutes = Math.min(
    MAX_REVIEW_DELAY_MINUTES,
    safeBase * multiplier,
  );
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

function getAutoNewCount(
  manualAssignmentsInWindow: number,
  decayFactor: number,
  minAutoNew: number,
) {
  if (manualAssignmentsInWindow <= 0) return 0;

  return Math.max(
    Math.max(0, minAutoNew),
    Math.ceil(manualAssignmentsInWindow * Math.max(0, decayFactor)),
  );
}

export async function assignStudentsToAssignment({
  assignmentId,
  studentIds,
  source,
  scheduleId,
  rootAssignmentId,
  reviewDueAt,
}: CreateStudentAssignmentsInput) {
  if (studentIds.length === 0) {
    return {
      assigned: 0,
      skipped: 0,
      total: 0,
    };
  }

  const existingAssignments = await prisma.studentAssignment.findMany({
    where: {
      assignmentId,
      studentId: { in: studentIds },
    },
    select: { studentId: true },
  });

  const existingSet = new Set(
    existingAssignments.map((item) => item.studentId),
  );
  const newStudentIds = studentIds.filter((id) => !existingSet.has(id));

  if (newStudentIds.length > 0) {
    await prisma.studentAssignment.createMany({
      data: newStudentIds.map((studentId) => ({
        studentId,
        assignmentId,
        submittedAt: null,
        source,
        scheduleId: scheduleId ?? null,
        rootAssignmentId: rootAssignmentId ?? assignmentId,
        reviewDueAt: reviewDueAt ?? null,
      })),
      skipDuplicates: true,
    });
  }

  return {
    assigned: newStudentIds.length,
    skipped: existingSet.size,
    total: studentIds.length,
  };
}

export async function getActiveScheduleForHomework(
  classId: string,
  homeworkNodeId: string,
) {
  const delegate = getAutoScheduleDelegate();
  if (!delegate) return null;

  return delegate.findFirst({
    where: {
      classId,
      homeworkNodeId,
      isActive: true,
    },
    select: {
      id: true,
      initialReviewDelayMinutes: true,
      maxRetryPerRoot: true,
    },
  });
}

export async function getOrCreateActiveScheduleForHomework(
  classId: string,
  homeworkNodeId: string,
  createdBy: string,
) {
  const delegate = getAutoScheduleDelegate();
  if (!delegate) return null;

  const existingActive = await delegate.findFirst({
    where: {
      classId,
      homeworkNodeId,
      isActive: true,
    },
    select: {
      id: true,
      initialReviewDelayMinutes: true,
      maxRetryPerRoot: true,
    },
  });

  if (existingActive) return existingActive;

  const existingAny = await delegate.findFirst({
    where: {
      classId,
      homeworkNodeId,
    },
    select: {
      id: true,
      isActive: true,
      initialReviewDelayMinutes: true,
      maxRetryPerRoot: true,
    },
  });

  if (existingAny) {
    if (!existingAny.isActive) return null;
    return existingAny;
  }

  const defaults = getDefaultScheduleConfig();

  const created = await (delegate as any).create({
    data: {
      classId,
      homeworkNodeId,
      createdBy,
      startAt: new Date(),
      intervalValue: defaults.intervalValue,
      intervalUnit: defaults.intervalUnit,
      decayFactor: defaults.decayFactor,
      minAutoNew: defaults.minAutoNew,
      initialReviewDelayMinutes: defaults.initialReviewDelayMinutes,
      maxRetryPerRoot: defaults.maxRetryPerRoot,
      isActive: true,
    },
    select: {
      id: true,
      initialReviewDelayMinutes: true,
      maxRetryPerRoot: true,
    },
  });

  return created;
}

export async function getScheduleById(scheduleId: string) {
  const delegate = getAutoScheduleDelegate();
  if (!delegate) return null;

  return delegate.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      initialReviewDelayMinutes: true,
      maxRetryPerRoot: true,
    },
  });
}

async function getDueSchedules(now: Date): Promise<AutoScheduleSnapshot[]> {
  const delegate = getAutoScheduleDelegate();
  if (!delegate) return [];

  const candidates = await delegate.findMany({
    where: {
      isActive: true,
      startAt: { lte: now },
    },
    select: {
      id: true,
      classId: true,
      homeworkNodeId: true,
      startAt: true,
      intervalValue: true,
      intervalUnit: true,
      decayFactor: true,
      minAutoNew: true,
      initialReviewDelayMinutes: true,
      maxRetryPerRoot: true,
      isActive: true,
      lastAutoRunAt: true,
      runCount: true,
    },
  });

  return candidates.filter((schedule) => {
    const checkpoint = schedule.lastAutoRunAt ?? schedule.startAt;
    const nextRunAt = new Date(
      checkpoint.getTime() +
        intervalUnitToMs(schedule.intervalValue, schedule.intervalUnit),
    );

    return nextRunAt <= now;
  });
}

async function createAutoNewAssignments(
  schedule: AutoScheduleSnapshot,
  windowStart: Date,
  windowEnd: Date,
  studentIds: string[],
) {
  const manualRows = await prisma.studentAssignment.findMany({
    where: {
      source: "teacher",
      createdAt: {
        gt: windowStart,
        lte: windowEnd,
      },
      assignment: {
        classId: schedule.classId,
        lessonNodeId: schedule.homeworkNodeId,
        type: "homework_imp",
      },
    },
    distinct: ["assignmentId"],
    select: {
      assignmentId: true,
    },
  });

  const templateAssignmentIds = manualRows.map((row) => row.assignmentId);
  const manualAssignmentsInWindow = templateAssignmentIds.length;
  const autoNewCount = getAutoNewCount(
    manualAssignmentsInWindow,
    schedule.decayFactor,
    schedule.minAutoNew,
  );

  if (autoNewCount === 0 || templateAssignmentIds.length === 0) {
    return {
      manualAssignmentsInWindow,
      autoNewCreated: 0,
    };
  }

  const templates = await prisma.classLessonNode.findMany({
    where: {
      id: { in: templateAssignmentIds },
    },
    select: {
      id: true,
      classId: true,
      lessonNodeId: true,
      type: true,
      content: true,
    },
  });

  if (templates.length === 0) {
    return {
      manualAssignmentsInWindow,
      autoNewCreated: 0,
    };
  }

  let autoNewCreated = 0;
  for (let index = 0; index < autoNewCount; index++) {
    const template = templates[index % templates.length];

    const createdAssignment = await prisma.classLessonNode.create({
      data: {
        classId: template.classId,
        lessonNodeId: template.lessonNodeId,
        type: "homework_imp",
        content: template.content as any,
      },
      select: {
        id: true,
      },
    });

    await assignStudentsToAssignment({
      assignmentId: createdAssignment.id,
      studentIds,
      source: "system",
      scheduleId: schedule.id,
      rootAssignmentId: createdAssignment.id,
      reviewDueAt: getInitialReviewDueAt(schedule.initialReviewDelayMinutes),
    });

    autoNewCreated += 1;
  }

  return {
    manualAssignmentsInWindow,
    autoNewCreated,
  };
}

function isCorrectSubmission(submissionData: unknown) {
  if (!submissionData || typeof submissionData !== "object") return false;

  const evaluation = (
    submissionData as { evaluation?: { isCorrect?: boolean } }
  ).evaluation;
  return evaluation?.isCorrect === true;
}

async function createRetryAssignments(
  schedule: AutoScheduleSnapshot,
  now: Date,
) {
  const attempts = await prisma.studentAssignment.findMany({
    where: {
      OR: [{ scheduleId: schedule.id }, { scheduleId: null }],
      assignment: {
        classId: schedule.classId,
        lessonNodeId: schedule.homeworkNodeId,
        type: "homework_imp",
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      studentId: true,
      assignmentId: true,
      rootAssignmentId: true,
      source: true,
      submissionData: true,
      reviewDueAt: true,
      createdAt: true,
      assignment: {
        select: {
          classId: true,
          lessonNodeId: true,
          content: true,
          type: true,
        },
      },
    },
  });

  const grouped = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const rootId = attempt.rootAssignmentId ?? attempt.assignmentId;
    const key = `${attempt.studentId}:${rootId}`;
    const list = grouped.get(key) ?? [];
    list.push(attempt);
    grouped.set(key, list);
  }

  let retryCreated = 0;
  let skipped = 0;

  for (const [, series] of grouped) {
    if (series.length === 0) continue;

    const latest = series[series.length - 1];
    const rootId = latest.rootAssignmentId ?? latest.assignmentId;
    const retriesAlready = Math.max(0, series.length - 1);

    if (retriesAlready >= schedule.maxRetryPerRoot) {
      skipped += 1;
      continue;
    }

    const derivedReviewDueAt =
      latest.reviewDueAt ??
      new Date(
        latest.createdAt.getTime() +
          Math.max(1, schedule.initialReviewDelayMinutes) * 60 * 1000,
      );

    if (derivedReviewDueAt > now) {
      continue;
    }

    if (isCorrectSubmission(latest.submissionData)) {
      await prisma.studentAssignment.update({
        where: { id: latest.id },
        data: { reviewDueAt: null },
      });
      skipped += 1;
      continue;
    }

    const cloned = await prisma.classLessonNode.create({
      data: {
        classId: latest.assignment.classId,
        lessonNodeId: latest.assignment.lessonNodeId,
        type: latest.assignment.type,
        content: latest.assignment.content as any,
      },
      select: {
        id: true,
      },
    });

    await assignStudentsToAssignment({
      assignmentId: cloned.id,
      studentIds: [latest.studentId],
      source: "system",
      scheduleId: schedule.id,
      rootAssignmentId: rootId,
      reviewDueAt: getNextRetryDueAt(
        schedule.initialReviewDelayMinutes,
        retriesAlready,
      ),
    });

    await prisma.studentAssignment.update({
      where: { id: latest.id },
      data: { reviewDueAt: null },
    });

    retryCreated += 1;
  }

  return {
    retryCreated,
    skipped,
  };
}

async function runSingleScheduleInternal(
  schedule: AutoScheduleSnapshot,
  forceRun: boolean,
  now: Date,
) {
  const checkpoint = schedule.lastAutoRunAt ?? schedule.startAt;
  const nextRunAt = new Date(
    checkpoint.getTime() +
      intervalUnitToMs(schedule.intervalValue, schedule.intervalUnit),
  );

  if (!forceRun && nextRunAt > now) {
    return null;
  }

  const students = await prisma.classMember.findMany({
    where: {
      classId: schedule.classId,
      role: "student",
    },
    select: {
      userId: true,
    },
  });

  const studentIds = students.map((item) => item.userId);

  const windowStart = schedule.lastAutoRunAt ?? schedule.startAt;
  const windowEnd = now;

  const createdSummary = await createAutoNewAssignments(
    schedule,
    windowStart,
    windowEnd,
    studentIds,
  );
  const retrySummary = await createRetryAssignments(schedule, now);

  const delegate = getAutoScheduleDelegate();
  if (!delegate) {
    return {
      scheduleId: schedule.id,
      manualAssignmentsInWindow: createdSummary.manualAssignmentsInWindow,
      autoNewCreated: createdSummary.autoNewCreated,
      retryCreated: retrySummary.retryCreated,
      skipped: retrySummary.skipped,
    } satisfies AutoRunSummary;
  }

  await delegate.update({
    where: { id: schedule.id },
    data: {
      lastAutoRunAt: now,
      runCount: {
        increment: 1,
      },
    },
  });

  return {
    scheduleId: schedule.id,
    manualAssignmentsInWindow: createdSummary.manualAssignmentsInWindow,
    autoNewCreated: createdSummary.autoNewCreated,
    retryCreated: retrySummary.retryCreated,
    skipped: retrySummary.skipped,
  } satisfies AutoRunSummary;
}

export async function runDueAutoAssignments(now: Date = new Date()) {
  const dueSchedules = await getDueSchedules(now);

  const summaries: AutoRunSummary[] = [];

  for (const schedule of dueSchedules) {
    const summary = await runSingleScheduleInternal(schedule, false, now);
    if (summary) {
      summaries.push(summary);
    }
  }

  return {
    executed: summaries.length,
    details: summaries,
  };
}

export async function runScheduleNow(
  scheduleId: string,
  now: Date = new Date(),
) {
  const delegate = getAutoScheduleDelegate();
  if (!delegate) return null;

  const schedule = await delegate.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      classId: true,
      homeworkNodeId: true,
      startAt: true,
      intervalValue: true,
      intervalUnit: true,
      decayFactor: true,
      minAutoNew: true,
      initialReviewDelayMinutes: true,
      maxRetryPerRoot: true,
      isActive: true,
      lastAutoRunAt: true,
      runCount: true,
    },
  });

  if (!schedule || !schedule.isActive) {
    return null;
  }

  return runSingleScheduleInternal(schedule, true, now);
}
