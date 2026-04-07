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

export interface WidgetGeneratorMeta {
  version: number;
  schema: Record<string, any>;
  resolvedDefaults?: Record<string, any>;
  difficultySync?: DifficultySyncConfig;
}

export const WIDGET_GENERATOR_META_KEY = "__molyGeneratorMeta";
const META_VERSION = 1;

const DIFFICULTY_ORDER: DifficultyLevel[] = ["easy", "medium", "hard"];

const DEFAULT_DIFFICULTY_WEIGHTS: Record<DifficultyLevel, number> = {
  easy: 5,
  medium: 3,
  hard: 2,
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  const output = deepClone(target);

  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value) && isRecord(output[key])) {
      output[key] = deepMerge(output[key], value);
      continue;
    }

    output[key] = deepClone(value);
  }

  return output;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }

  return undefined;
}

function getConfigValue(config: Record<string, any>, path: string): any {
  const parts = path.split(".").filter((part) => part.length > 0);
  let current: any = config;

  for (const part of parts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }

  return current;
}

function setConfigValue(
  config: Record<string, any>,
  path: string,
  value: any,
): boolean {
  const parts = path.split(".").filter((part) => part.length > 0);
  if (parts.length < 1) return false;

  let container: Record<string, any> = config;

  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    const current = container[part];

    if (!isRecord(current)) {
      container[part] = {};
    }

    container = container[part] as Record<string, any>;
  }

  const leaf = parts[parts.length - 1];
  if (Object.is(container[leaf], value)) return false;

  container[leaf] = value;
  return true;
}

function getSchemaFieldByPath(schema: Record<string, any>, path: string): any {
  const parts = path.split(".").filter((part) => part.length > 0);
  let current: any = schema;

  for (const part of parts) {
    if (!isRecord(current)) return null;

    if (current[part] !== undefined) {
      current = current[part];
      continue;
    }

    if (isRecord(current.fields) && current.fields[part] !== undefined) {
      current = current.fields[part];
      continue;
    }

    return null;
  }

  return current;
}

function evaluateCondition(
  condition: any,
  config: Record<string, any>,
): boolean {
  if (!condition) return true;

  if (Array.isArray(condition.and)) {
    return condition.and.every((item: any) => evaluateCondition(item, config));
  }

  if (Array.isArray(condition.or)) {
    return condition.or.some((item: any) => evaluateCondition(item, config));
  }

  const value = getConfigValue(config, condition.param);

  if (condition.equals !== undefined) return value === condition.equals;
  if (condition.notEquals !== undefined) return value !== condition.notEquals;
  if (condition.in !== undefined)
    return Array.isArray(condition.in) && condition.in.includes(value);
  if (condition.gt !== undefined) return value > condition.gt;
  if (condition.gte !== undefined) return value >= condition.gte;
  if (condition.lt !== undefined) return value < condition.lt;
  if (condition.lte !== undefined) return value <= condition.lte;

  return true;
}

function randomInt(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean() {
  return Math.random() >= 0.5;
}

function clamp(
  value: number,
  minBound: number | undefined,
  maxBound: number | undefined,
): number {
  let output = value;

  if (minBound !== undefined && output < minBound) {
    output = minBound;
  }

  if (maxBound !== undefined && output > maxBound) {
    output = maxBound;
  }

  return output;
}

function normalizeRange(
  minBound: number | undefined,
  maxBound: number | undefined,
): [number | undefined, number | undefined] {
  if (minBound === undefined || maxBound === undefined) {
    return [minBound, maxBound];
  }

  if (minBound <= maxBound) {
    return [minBound, maxBound];
  }

  return [minBound, minBound];
}

function applyRandomization(
  config: Record<string, any>,
  schema: Record<string, any>,
  rootConfig: Record<string, any>,
): void {
  for (const [key, field] of Object.entries(schema)) {
    if (!isRecord(field)) continue;

    if (field.type === "folder" && isRecord(field.fields)) {
      if (!isRecord(config[key])) {
        config[key] = {};
      }

      applyRandomization(config[key], field.fields, rootConfig);
      continue;
    }

    if (!field.random) continue;

    if (field.type === "number") {
      const staticMin = toFiniteNumber(field.min);
      const staticMax = toFiniteNumber(field.max);
      const dynamicMin =
        typeof field.minFrom === "string"
          ? toFiniteNumber(getConfigValue(rootConfig, field.minFrom))
          : undefined;
      const dynamicMax =
        typeof field.maxFrom === "string"
          ? toFiniteNumber(getConfigValue(rootConfig, field.maxFrom))
          : undefined;

      const rawMin = dynamicMin ?? staticMin ?? 0;
      const rawMax = dynamicMax ?? staticMax ?? rawMin;
      const [safeMin, safeMax] = normalizeRange(rawMin, rawMax);

      const step = toFiniteNumber(field.step);
      if (
        step !== undefined &&
        step > 0 &&
        safeMin !== undefined &&
        safeMax !== undefined
      ) {
        const totalSteps = Math.max(0, Math.floor((safeMax - safeMin) / step));
        const randomStep = randomInt(0, totalSteps);
        config[key] = safeMin + randomStep * step;
      } else if (safeMin !== undefined && safeMax !== undefined) {
        config[key] = randomInt(Math.round(safeMin), Math.round(safeMax));
      }

      continue;
    }

    if (field.type === "boolean") {
      config[key] = randomBoolean();
      continue;
    }

    if (
      field.type === "select" &&
      Array.isArray(field.options) &&
      field.options.length > 0
    ) {
      config[key] = field.options[randomInt(0, field.options.length - 1)];
    }
  }
}

function collectNumberFields(
  schema: Record<string, any>,
  prefix: string[] = [],
  output: Array<{ path: string; field: Record<string, any> }> = [],
) {
  for (const [key, field] of Object.entries(schema)) {
    if (!isRecord(field)) continue;

    if (field.type === "folder" && isRecord(field.fields)) {
      collectNumberFields(field.fields, [...prefix, key], output);
      continue;
    }

    if (field.type === "number") {
      output.push({ path: [...prefix, key].join("."), field });
    }
  }

  return output;
}

function enforceNumberConstraints(
  config: Record<string, any>,
  schema: Record<string, any>,
): boolean {
  const numericFields = collectNumberFields(schema);
  let changed = false;

  for (const { path, field } of numericFields) {
    const currentValue = toFiniteNumber(getConfigValue(config, path));
    if (currentValue === undefined) continue;

    const staticMin = toFiniteNumber(field.min);
    const staticMax = toFiniteNumber(field.max);
    const dynamicMin =
      typeof field.minFrom === "string"
        ? toFiniteNumber(getConfigValue(config, field.minFrom))
        : undefined;
    const dynamicMax =
      typeof field.maxFrom === "string"
        ? toFiniteNumber(getConfigValue(config, field.maxFrom))
        : undefined;

    let minBound = dynamicMin ?? staticMin;
    let maxBound = dynamicMax ?? staticMax;
    [minBound, maxBound] = normalizeRange(minBound, maxBound);

    const step = toFiniteNumber(field.step);
    let nextValue = clamp(currentValue, minBound, maxBound);

    if (step !== undefined && step > 0) {
      nextValue = Math.round(nextValue / step) * step;
      nextValue = clamp(nextValue, minBound, maxBound);
    }

    if (!Object.is(nextValue, currentValue)) {
      changed = setConfigValue(config, path, nextValue) || changed;
    }
  }

  return changed;
}

function isDifficultyNumberRange(
  levelRule: DifficultyLevelRange,
): levelRule is DifficultyNumberRange {
  return (
    (levelRule.type === undefined || levelRule.type === "number") &&
    typeof (levelRule as DifficultyNumberRange).min === "number" &&
    typeof (levelRule as DifficultyNumberRange).max === "number"
  );
}

function isDifficultyBooleanMatch(
  levelRule: DifficultyLevelRange,
): levelRule is DifficultyBooleanMatch {
  if ((levelRule as any).type === "boolean") {
    return true;
  }

  return (
    Object.prototype.hasOwnProperty.call(levelRule, "equals") &&
    typeof (levelRule as any).equals === "boolean"
  );
}

function isDifficultySelectMatch(
  levelRule: DifficultyLevelRange,
): levelRule is DifficultySelectMatch {
  if ((levelRule as any).type === "select") {
    return true;
  }

  return (
    Object.prototype.hasOwnProperty.call(levelRule, "in") &&
    Array.isArray((levelRule as any).in)
  );
}

function pickFirstSelectableValue(
  candidates: DifficultyScalarValue[],
  field: any,
): DifficultyScalarValue | undefined {
  if (!Array.isArray(candidates) || candidates.length < 1) {
    return undefined;
  }

  if (Array.isArray(field?.options) && field.options.length > 0) {
    for (const candidate of candidates) {
      if (
        field.options.some((option: unknown) => Object.is(option, candidate))
      ) {
        return candidate;
      }
    }

    return field.options[0] as DifficultyScalarValue;
  }

  return candidates[0];
}

function resolveDifficultyPresetValue(
  levelRule: DifficultyLevelRange,
  field: any,
): DifficultyScalarValue | undefined {
  if ((levelRule as any).preset !== undefined) {
    const preset = (levelRule as any).preset as DifficultyScalarValue;

    if (field?.type === "number") {
      const numeric = toFiniteNumber(preset);
      if (numeric === undefined) return undefined;
      return numeric;
    }

    if (field?.type === "boolean") {
      return toBoolean(preset);
    }

    if (field?.type === "select") {
      return pickFirstSelectableValue([preset], field);
    }

    return preset;
  }

  if (isDifficultyNumberRange(levelRule)) {
    return Math.round((levelRule.min + levelRule.max) / 2);
  }

  if (isDifficultyBooleanMatch(levelRule)) {
    return levelRule.equals;
  }

  if (isDifficultySelectMatch(levelRule)) {
    return pickFirstSelectableValue(levelRule.in, field);
  }

  return undefined;
}

function applyDifficultyPreset(
  config: Record<string, any>,
  meta: WidgetGeneratorMeta,
  desiredDifficulty: DifficultyLevel,
): boolean {
  const syncConfig = meta.difficultySync;
  if (!syncConfig || !Array.isArray(syncConfig.rules)) {
    return setConfigValue(config, "difficulty", desiredDifficulty);
  }

  const difficultyPath = syncConfig.difficultyPath || "difficulty";
  let changed = setConfigValue(config, difficultyPath, desiredDifficulty);

  const activeRule = syncConfig.rules.find((rule) => {
    if (
      !rule ||
      !Array.isArray(rule.dimensions) ||
      rule.dimensions.length < 1
    ) {
      return false;
    }

    if (!rule.when) return true;
    return evaluateCondition(rule.when, config);
  });

  if (!activeRule) {
    return changed;
  }

  for (const dimension of activeRule.dimensions) {
    const levelRule = dimension.levels?.[desiredDifficulty];
    if (!levelRule) continue;

    const field = getSchemaFieldByPath(meta.schema, dimension.path);
    const presetValue = resolveDifficultyPresetValue(levelRule, field);
    if (presetValue === undefined) continue;

    changed = setConfigValue(config, dimension.path, presetValue) || changed;
  }

  return changed;
}

function extractDefaultsFromSchema(
  schema: Record<string, any>,
): Record<string, any> {
  const defaults: Record<string, any> = {};

  for (const [key, field] of Object.entries(schema)) {
    if (!isRecord(field)) continue;

    if (field.type === "folder" && isRecord(field.fields)) {
      defaults[key] = extractDefaultsFromSchema(field.fields);
      continue;
    }

    if (field.default !== undefined) {
      defaults[key] = deepClone(field.default);
    }
  }

  return defaults;
}

export function buildGeneratorMeta(
  widgetDef: {
    schema: Record<string, any>;
    resolvedDefaults?: Record<string, any>;
    difficultySync?: DifficultySyncConfig;
  } | null,
): WidgetGeneratorMeta | null {
  if (!widgetDef?.schema || !isRecord(widgetDef.schema)) {
    return null;
  }

  return {
    version: META_VERSION,
    schema: deepClone(widgetDef.schema),
    resolvedDefaults: widgetDef.resolvedDefaults
      ? deepClone(widgetDef.resolvedDefaults)
      : undefined,
    difficultySync: widgetDef.difficultySync
      ? deepClone(widgetDef.difficultySync)
      : undefined,
  };
}

export function extractGeneratorMeta(
  content: Record<string, any> | null | undefined,
): WidgetGeneratorMeta | null {
  if (!isRecord(content)) return null;

  const rawMeta = content[WIDGET_GENERATOR_META_KEY];
  if (!isRecord(rawMeta) || !isRecord(rawMeta.schema)) {
    return null;
  }

  return rawMeta as WidgetGeneratorMeta;
}

export function stripGeneratorMeta(
  content: Record<string, any> | null | undefined,
): Record<string, any> {
  if (!isRecord(content)) return {};

  const cloned = deepClone(content);
  delete cloned[WIDGET_GENERATOR_META_KEY];
  return cloned;
}

export function attachGeneratorMeta(
  config: Record<string, any>,
  meta: WidgetGeneratorMeta | null,
): Record<string, any> {
  const clonedConfig = deepClone(config);

  if (!meta) return clonedConfig;

  return {
    ...clonedConfig,
    [WIDGET_GENERATOR_META_KEY]: deepClone(meta),
  };
}

export function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return value === "easy" || value === "medium" || value === "hard";
}

export function buildDifficultyCounts(
  total: number,
  weights: Record<DifficultyLevel, number> = DEFAULT_DIFFICULTY_WEIGHTS,
): Record<DifficultyLevel, number> {
  const normalizedTotal = Math.max(0, Math.floor(total));
  const counts: Record<DifficultyLevel, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  if (normalizedTotal < 1) return counts;

  const totalWeight = DIFFICULTY_ORDER.reduce(
    (sum, level) => sum + Math.max(0, weights[level] ?? 0),
    0,
  );

  if (totalWeight <= 0) {
    counts.easy = normalizedTotal;
    return counts;
  }

  const fractions = DIFFICULTY_ORDER.map((level, index) => {
    const expected =
      (normalizedTotal * Math.max(0, weights[level] ?? 0)) / totalWeight;
    const base = Math.floor(expected);
    counts[level] = base;

    return {
      level,
      fraction: expected - base,
      priority: index,
    };
  });

  let remaining =
    normalizedTotal -
    DIFFICULTY_ORDER.reduce((sum, level) => sum + counts[level], 0);

  fractions.sort((a, b) => {
    if (b.fraction !== a.fraction) return b.fraction - a.fraction;
    return a.priority - b.priority;
  });

  for (let index = 0; index < remaining; index++) {
    const target = fractions[index % fractions.length];
    counts[target.level] += 1;
  }

  return counts;
}

export function buildDifficultySequence(
  total: number,
  weights: Record<DifficultyLevel, number> = DEFAULT_DIFFICULTY_WEIGHTS,
): DifficultyLevel[] {
  const counts = buildDifficultyCounts(total, weights);

  const sequence: DifficultyLevel[] = [];
  for (const level of DIFFICULTY_ORDER) {
    for (let index = 0; index < counts[level]; index++) {
      sequence.push(level);
    }
  }

  return sequence;
}

export function applyDifficultyToConfig(
  config: Record<string, any>,
  meta: WidgetGeneratorMeta | null,
  desiredDifficulty: DifficultyLevel,
): Record<string, any> {
  const nextConfig = deepClone(config);

  if (!isDifficultyLevel(desiredDifficulty)) {
    return nextConfig;
  }

  if (!meta) {
    if ("difficulty" in nextConfig) {
      nextConfig.difficulty = desiredDifficulty;
    }
    return nextConfig;
  }

  applyDifficultyPreset(nextConfig, meta, desiredDifficulty);

  for (let index = 0; index < 5; index++) {
    const changed = enforceNumberConstraints(nextConfig, meta.schema);
    if (!changed) break;
  }

  return nextConfig;
}

export function generateConfigFromTemplateContent(
  templateContent: Record<string, any>,
  desiredDifficulty?: DifficultyLevel,
): Record<string, any> | null {
  const meta = extractGeneratorMeta(templateContent);
  if (!meta) {
    return null;
  }

  const plainTemplateConfig = stripGeneratorMeta(templateContent);

  const baseDefaults = isRecord(meta.resolvedDefaults)
    ? deepClone(meta.resolvedDefaults)
    : extractDefaultsFromSchema(meta.schema);

  const mergedBase = deepMerge(baseDefaults, plainTemplateConfig);

  applyRandomization(mergedBase, meta.schema, mergedBase);

  if (desiredDifficulty && isDifficultyLevel(desiredDifficulty)) {
    applyDifficultyPreset(mergedBase, meta, desiredDifficulty);
  }

  for (let index = 0; index < 5; index++) {
    const changed = enforceNumberConstraints(mergedBase, meta.schema);
    if (!changed) break;
  }

  return mergedBase;
}

export function getDifficultyFromContent(
  content: Record<string, any> | null | undefined,
): DifficultyLevel | null {
  const plainConfig = stripGeneratorMeta(content);
  const meta = extractGeneratorMeta(content);

  const difficultyPath = meta?.difficultySync?.difficultyPath || "difficulty";
  const rawDifficulty = getConfigValue(plainConfig, difficultyPath);

  if (isDifficultyLevel(rawDifficulty)) {
    return rawDifficulty;
  }

  return null;
}
