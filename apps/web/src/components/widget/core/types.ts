export interface WidgetDefinition {
  schema: Record<string, any>;
  resolvedDefaults?: Record<string, any>;
  hasEvaluator?: boolean;
  difficultySync?: DifficultySyncConfig;
}

export type DifficultyLevel = "easy" | "medium" | "hard";

export type DifficultyScalarValue = string | number | boolean;

export interface DifficultyNumberRange {
  type?: "number";
  min: number;
  max: number;
  preset?: number;
}

export interface DifficultyBooleanMatch {
  type: "boolean";
  equals: boolean;
  preset?: boolean;
}

export interface DifficultySelectMatch {
  type: "select";
  in: DifficultyScalarValue[];
  preset?: DifficultyScalarValue;
}

export type DifficultyLevelRange =
  | DifficultyNumberRange
  | DifficultyBooleanMatch
  | DifficultySelectMatch;

export interface DifficultyDimension {
  path: string;
  weight?: number;
  levels: Record<DifficultyLevel, DifficultyLevelRange>;
}

export interface DifficultyRule {
  when?: any;
  dimensions: DifficultyDimension[];
}

export interface DifficultySyncConfig {
  difficultyPath: string;
  rules: DifficultyRule[];
}

export interface Submission {
  answer: any;
  evaluation: {
    isCorrect: boolean;
    score: number;
    maxScore: number;
  };
}

export interface HostTtsResult {
  ok: boolean;
  error?: string;
}

export interface HostSttResult {
  ok: boolean;
  transcript?: string;
  error?: string;
}

export type SttMode = "free-text" | "number";
