export interface WidgetDefinition {
  schema: Record<string, any>;
  resolvedDefaults?: Record<string, any>;
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
