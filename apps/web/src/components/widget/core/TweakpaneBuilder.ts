import {
  DifficultyBooleanMatch,
  DifficultyLevel,
  DifficultyLevelRange,
  DifficultyNumberRange,
  DifficultyRule,
  DifficultyScalarValue,
  DifficultySelectMatch,
  DifficultySyncConfig,
} from "./types";

export class TweakpaneBuilder {
  private pane: any;
  private config: Record<string, any>;
  private schema: Record<string, any>;
  private difficultySync?: DifficultySyncConfig;
  private onChange: (config: Record<string, any>) => void;
  private controlsMap: Map<string, any> = new Map();
  private lastDifficultySnapshot: {
    ruleIndex: number;
    difficulty: DifficultyLevel;
    inputSignature: string;
  } | null = null;

  constructor(
    pane: any,
    config: Record<string, any>,
    schema: Record<string, any>,
    difficultySync: DifficultySyncConfig | undefined,
    onChange: (config: Record<string, any>) => void,
  ) {
    this.pane = pane;
    this.config = config;
    this.schema = schema;
    this.difficultySync = difficultySync;
    this.onChange = onChange;
  }

  build() {
    Object.keys(this.schema).forEach((key) => {
      const field = this.schema[key];
      this.processField(key, field, this.pane, this.config, []);
    });

    const initDifficultySync = this.syncWidgetDifficulty(true);
    const hasInitConstraintChanges = this.enforceNumberConstraints();
    const initDifficultyRecalc =
      hasInitConstraintChanges || !initDifficultySync.droveByDifficulty
        ? this.syncWidgetDifficulty(false)
        : { changed: false, droveByDifficulty: false };

    if (
      initDifficultySync.changed ||
      hasInitConstraintChanges ||
      initDifficultyRecalc.changed
    ) {
      this.refreshPane();
    }

    this.pane.on("change", async () => {
      const firstDifficultySync = this.syncWidgetDifficulty(false);
      const hasConstraintChanges = this.enforceNumberConstraints();
      const secondDifficultySync =
        hasConstraintChanges || !firstDifficultySync.droveByDifficulty
          ? this.syncWidgetDifficulty(false)
          : { changed: false, droveByDifficulty: false };

      if (
        firstDifficultySync.changed ||
        hasConstraintChanges ||
        secondDifficultySync.changed
      ) {
        this.refreshPane();
      }
      this.updateVisibility();
      const serializedConfig = await this.serializeConfig(this.config);
      this.onChange(serializedConfig);
    });

    this.updateVisibility();
  }

  private checkVisibility(condition: any): boolean {
    return this.evaluateCondition(condition, this.config);
  }

  private evaluateCondition(
    condition: any,
    config: Record<string, any>,
  ): boolean {
    if (!condition) return true;

    if (condition.and) {
      return condition.and.every((c: any) => this.evaluateCondition(c, config));
    }

    if (condition.or) {
      return condition.or.some((c: any) => this.evaluateCondition(c, config));
    }

    const value = this.getConfigValueFrom(config, condition.param);

    if (condition.equals !== undefined) return value === condition.equals;
    if (condition.notEquals !== undefined) return value !== condition.notEquals;
    if (condition.in !== undefined) return condition.in.includes(value);
    if (condition.gt !== undefined) return value > condition.gt;
    if (condition.gte !== undefined) return value >= condition.gte;
    if (condition.lt !== undefined) return value < condition.lt;
    if (condition.lte !== undefined) return value <= condition.lte;

    return true;
  }

  private getConfigValue(path: string): any {
    return this.getConfigValueFrom(this.config, path);
  }

  private getConfigValueFrom(config: Record<string, any>, path: string): any {
    const parts = path.split(".");
    let value = config;

    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }

    return value;
  }

  private updateVisibility() {
    this.controlsMap.forEach((control, path) => {
      const field = this.getFieldFromPath(path);
      if (field && field.visibleIf) {
        const visible = this.checkVisibility(field.visibleIf);
        control.hidden = !visible;
      }
    });
  }

  private syncWidgetDifficulty(forcePreset: boolean): {
    changed: boolean;
    droveByDifficulty: boolean;
  } {
    if (!this.difficultySync || !Array.isArray(this.difficultySync.rules)) {
      this.lastDifficultySnapshot = null;
      return { changed: false, droveByDifficulty: false };
    }

    const activeRule = this.getActiveDifficultyRule();
    if (!activeRule) {
      this.lastDifficultySnapshot = null;
      return { changed: false, droveByDifficulty: false };
    }

    const difficulty = this.normalizeDifficultyLevel(
      this.getConfigValue(this.difficultySync.difficultyPath),
    );
    if (!difficulty) {
      return { changed: false, droveByDifficulty: false };
    }

    const currentSignature = this.getDifficultyInputSignature(activeRule.rule);
    const previous = this.lastDifficultySnapshot;
    const ruleChanged = previous
      ? previous.ruleIndex !== activeRule.ruleIndex
      : false;
    const difficultyChanged = previous
      ? previous.difficulty !== difficulty
      : false;
    const inputsChanged = previous
      ? previous.inputSignature !== currentSignature
      : false;

    let changed = false;
    let droveByDifficulty = false;

    if (forcePreset || difficultyChanged || ruleChanged) {
      changed =
        this.applyDifficultyPreset(activeRule.rule, difficulty) || changed;
      droveByDifficulty = true;

      if (changed) {
        console.log("[difficulty-test]", {
          source: forcePreset ? "init-preset" : "difficulty->params",
          rule: activeRule.ruleIndex,
          difficulty,
        });
      }
    } else if (inputsChanged) {
      const inferredDifficulty = this.classifyDifficulty(
        activeRule.rule,
        difficulty,
      );
      if (inferredDifficulty && inferredDifficulty !== difficulty) {
        changed =
          this.setConfigValue(
            this.difficultySync.difficultyPath,
            inferredDifficulty,
          ) || changed;

        if (changed) {
          console.log("[difficulty-test]", {
            source: "params->difficulty",
            rule: activeRule.ruleIndex,
            difficulty: inferredDifficulty,
          });
        }
      }
    }

    const nextDifficulty =
      this.normalizeDifficultyLevel(
        this.getConfigValue(this.difficultySync.difficultyPath),
      ) || difficulty;
    this.lastDifficultySnapshot = {
      ruleIndex: activeRule.ruleIndex,
      difficulty: nextDifficulty,
      inputSignature: this.getDifficultyInputSignature(activeRule.rule),
    };

    return {
      changed,
      droveByDifficulty,
    };
  }

  private getActiveDifficultyRule(): {
    rule: DifficultyRule;
    ruleIndex: number;
  } | null {
    if (!this.difficultySync) return null;

    for (let index = 0; index < this.difficultySync.rules.length; index++) {
      const rule = this.difficultySync.rules[index];
      if (
        !rule ||
        !Array.isArray(rule.dimensions) ||
        rule.dimensions.length < 1
      ) {
        continue;
      }

      if (!rule.when || this.evaluateCondition(rule.when, this.config)) {
        return {
          rule,
          ruleIndex: index,
        };
      }
    }

    return null;
  }

  private normalizeDifficultyLevel(value: unknown): DifficultyLevel | null {
    if (value === "easy" || value === "medium" || value === "hard") {
      return value;
    }

    return null;
  }

  private getDifficultyInputSignature(rule: DifficultyRule): string {
    return rule.dimensions
      .map((dimension) => {
        const value = this.getConfigValue(dimension.path);
        return `${dimension.path}:${this.serializeDifficultyValue(value)}`;
      })
      .join("|");
  }

  private serializeDifficultyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "na";
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return `n:${value}`;
    }

    if (typeof value === "boolean") {
      return `b:${value}`;
    }

    if (typeof value === "string") {
      return `s:${value}`;
    }

    try {
      return `j:${JSON.stringify(value)}`;
    } catch {
      return `u:${String(value)}`;
    }
  }

  private applyDifficultyPreset(
    rule: DifficultyRule,
    difficulty: DifficultyLevel,
  ): boolean {
    let changed = false;

    rule.dimensions.forEach((dimension) => {
      const levelRule = dimension.levels?.[difficulty];
      if (!levelRule) return;
      const field = this.getFieldFromPath(dimension.path);
      const nextValue = this.resolveDifficultyPreset(levelRule, field);
      if (nextValue === undefined) return;

      changed = this.setConfigValue(dimension.path, nextValue) || changed;
    });

    return changed;
  }

  private resolveDifficultyPreset(
    levelRule: DifficultyLevelRange,
    field: any,
  ): DifficultyScalarValue | undefined {
    if (levelRule.preset !== undefined) {
      return this.normalizePresetValue(levelRule.preset, field);
    }

    if (this.isDifficultyNumberRange(levelRule)) {
      const min = this.toFiniteNumber(levelRule.min);
      const max = this.toFiniteNumber(levelRule.max);
      if (min === undefined || max === undefined) {
        return undefined;
      }

      let nextValue = Math.round((min + max) / 2);
      const step = this.toFiniteNumber(field?.step);
      if (step !== undefined && step > 0) {
        nextValue = Math.round(nextValue / step) * step;
      }

      return this.clampNumberValue(
        nextValue,
        Math.min(min, max),
        Math.max(min, max),
      );
    }

    if (this.isDifficultyBooleanMatch(levelRule)) {
      return levelRule.equals;
    }

    if (this.isDifficultySelectMatch(levelRule)) {
      return this.pickFirstSelectableValue(levelRule.in, field);
    }

    return undefined;
  }

  private normalizePresetValue(
    preset: DifficultyScalarValue,
    field: any,
  ): DifficultyScalarValue | undefined {
    if (!field) {
      return preset;
    }

    if (field.type === "number") {
      const numeric = this.toFiniteNumber(preset);
      if (numeric === undefined) {
        return undefined;
      }

      let next = numeric;
      const step = this.toFiniteNumber(field.step);
      if (step !== undefined && step > 0) {
        next = Math.round(next / step) * step;
      }

      const { minBound, maxBound } = this.getNumberBounds(field);
      return this.clampNumberValue(next, minBound, maxBound);
    }

    if (field.type === "boolean") {
      return this.toBoolean(preset);
    }

    if (field.type === "select") {
      return this.pickFirstSelectableValue([preset], field);
    }

    return preset;
  }

  private pickFirstSelectableValue(
    candidates: DifficultyScalarValue[],
    field: any,
  ): DifficultyScalarValue | undefined {
    if (!Array.isArray(candidates) || candidates.length < 1) {
      return undefined;
    }

    if (Array.isArray(field?.options) && field.options.length > 0) {
      for (const candidate of candidates) {
        if (
          field.options.some((option: unknown) =>
            this.scalarEquals(option as DifficultyScalarValue, candidate),
          )
        ) {
          return candidate;
        }
      }

      return field.options[0] as DifficultyScalarValue;
    }

    return candidates[0];
  }

  private setConfigValue(path: string, value: any): boolean {
    const parts = path.split(".").filter((part) => part.length > 0);
    if (parts.length < 1) {
      return false;
    }

    let container = this.config;
    for (let index = 0; index < parts.length - 1; index++) {
      const part = parts[index];
      const current = container[part];
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        container[part] = {};
      }
      container = container[part] as Record<string, any>;
    }

    const leafKey = parts[parts.length - 1];
    if (container[leafKey] === value) {
      return false;
    }

    container[leafKey] = value;
    return true;
  }

  private classifyDifficulty(
    rule: DifficultyRule,
    _preferredDifficulty?: DifficultyLevel,
  ): DifficultyLevel | null {
    const scores: Record<DifficultyLevel, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    let hasSignal = false;

    rule.dimensions.forEach((dimension) => {
      const value = this.getConfigValue(dimension.path);
      if (value === undefined) {
        return;
      }

      const weight = this.toFiniteNumber(dimension.weight) ?? 1;
      const normalizedWeight = weight > 0 ? weight : 1;
      let hasDimensionSignal = false;

      (Object.keys(scores) as DifficultyLevel[]).forEach((level) => {
        const levelRule = dimension.levels?.[level];
        if (!levelRule) {
          return;
        }

        hasDimensionSignal = true;
        const fit = this.computeDifficultyFit(value, levelRule);
        scores[level] += fit * normalizedWeight;
      });

      if (hasDimensionSignal) {
        hasSignal = true;
      }
    });

    if (!hasSignal) {
      return null;
    }

    const levelOrder: DifficultyLevel[] = ["easy", "medium", "hard"];
    let bestLevel: DifficultyLevel = levelOrder[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    levelOrder.forEach((level) => {
      const score = scores[level];
      if (score > bestScore + 1e-6) {
        bestScore = score;
        bestLevel = level;
      }
    });

    return bestLevel;
  }

  private computeDifficultyFit(
    value: unknown,
    levelRule: DifficultyLevelRange,
  ): number {
    if (this.isDifficultyNumberRange(levelRule)) {
      const numberValue = this.toFiniteNumber(value);
      const min = this.toFiniteNumber(levelRule.min);
      const max = this.toFiniteNumber(levelRule.max);

      if (numberValue === undefined || min === undefined || max === undefined) {
        return 0;
      }

      return this.computeRangeFit(numberValue, min, max);
    }

    if (this.isDifficultyBooleanMatch(levelRule)) {
      const boolValue = this.toBoolean(value);
      if (boolValue === undefined) {
        return 0;
      }

      return boolValue === levelRule.equals ? 1 : 0;
    }

    if (this.isDifficultySelectMatch(levelRule)) {
      if (!Array.isArray(levelRule.in) || levelRule.in.length < 1) {
        return 0;
      }

      return levelRule.in.some((candidate) =>
        this.scalarEquals(candidate, value),
      )
        ? 1
        : 0;
    }

    return 0;
  }

  private isDifficultyNumberRange(
    levelRule: DifficultyLevelRange,
  ): levelRule is DifficultyNumberRange {
    const min = this.toFiniteNumber((levelRule as DifficultyNumberRange).min);
    const max = this.toFiniteNumber((levelRule as DifficultyNumberRange).max);

    return (
      (levelRule.type === undefined || levelRule.type === "number") &&
      min !== undefined &&
      max !== undefined
    );
  }

  private isDifficultyBooleanMatch(
    levelRule: DifficultyLevelRange,
  ): levelRule is DifficultyBooleanMatch {
    return (
      levelRule.type === "boolean" ||
      ("equals" in levelRule && typeof levelRule.equals === "boolean")
    );
  }

  private isDifficultySelectMatch(
    levelRule: DifficultyLevelRange,
  ): levelRule is DifficultySelectMatch {
    return (
      levelRule.type === "select" ||
      ("in" in levelRule && Array.isArray(levelRule.in))
    );
  }

  private scalarEquals(
    expected: DifficultyScalarValue,
    actual: unknown,
  ): boolean {
    if (typeof expected === "number") {
      const actualNumber = this.toFiniteNumber(actual);
      return actualNumber !== undefined && actualNumber === expected;
    }

    if (typeof expected === "boolean") {
      const actualBoolean = this.toBoolean(actual);
      return actualBoolean !== undefined && actualBoolean === expected;
    }

    if (typeof actual === "string") {
      return actual === expected;
    }

    return String(actual) === expected;
  }

  private computeRangeFit(
    value: number,
    minValue: number,
    maxValue: number,
  ): number {
    const min = Math.min(minValue, maxValue);
    const max = Math.max(minValue, maxValue);

    if (value >= min && value <= max) {
      return 1;
    }

    const span = Math.max(1, max - min);
    const distance = value < min ? min - value : value - max;

    return Math.max(0, 1 - distance / (span * 2));
  }

  private enforceNumberConstraints(): boolean {
    let hasAnyChanges = false;

    for (let iteration = 0; iteration < 5; iteration++) {
      const hasChanges = this.enforceNumberConstraintsPass(
        this.schema,
        this.config,
      );

      if (hasChanges) {
        hasAnyChanges = true;
      }

      if (!hasChanges) {
        break;
      }
    }

    return hasAnyChanges;
  }

  private refreshPane() {
    this.controlsMap.forEach((control) => {
      if (typeof control?.refresh === "function") {
        control.refresh();
      }
    });

    if (typeof this.pane?.refresh === "function") {
      this.pane.refresh();
    }

    window.requestAnimationFrame(() => {
      this.controlsMap.forEach((control) => {
        if (typeof control?.refresh === "function") {
          control.refresh();
        }
      });

      if (typeof this.pane?.refresh === "function") {
        this.pane.refresh();
      }
    });
  }

  private enforceNumberConstraintsPass(
    schema: Record<string, any>,
    parentConfig: Record<string, any>,
  ): boolean {
    let hasChanges = false;

    Object.keys(schema).forEach((key) => {
      const field = schema[key];

      if (field.type === "folder") {
        if (!parentConfig[key]) {
          parentConfig[key] = {};
        }

        if (field.fields) {
          const nestedChanged = this.enforceNumberConstraintsPass(
            field.fields,
            parentConfig[key],
          );
          if (nestedChanged) {
            hasChanges = true;
          }
        }
        return;
      }

      if (field.type !== "number") {
        return;
      }

      const rawValue = parentConfig[key];
      const currentValue = this.toFiniteNumber(rawValue);
      if (currentValue === undefined) {
        return;
      }

      if (rawValue !== currentValue) {
        parentConfig[key] = currentValue;
        hasChanges = true;
      }

      const { minBound, maxBound } = this.getNumberBounds(field);
      const nextValue = this.clampNumberValue(currentValue, minBound, maxBound);

      if (nextValue !== currentValue) {
        parentConfig[key] = nextValue;
        hasChanges = true;
      }
    });

    return hasChanges;
  }

  private getNumberBounds(field: any): {
    minBound: number | undefined;
    maxBound: number | undefined;
  } {
    let minBound =
      typeof field.min === "number" && Number.isFinite(field.min)
        ? field.min
        : undefined;
    let maxBound =
      typeof field.max === "number" && Number.isFinite(field.max)
        ? field.max
        : undefined;

    const dynamicMin = this.getNumericConstraintValue(field.minFrom);
    const dynamicMax = this.getNumericConstraintValue(field.maxFrom);

    if (dynamicMin !== undefined) {
      minBound =
        minBound === undefined ? dynamicMin : Math.max(minBound, dynamicMin);
    }

    if (dynamicMax !== undefined) {
      maxBound =
        maxBound === undefined ? dynamicMax : Math.min(maxBound, dynamicMax);
    }

    if (
      minBound !== undefined &&
      maxBound !== undefined &&
      minBound > maxBound
    ) {
      maxBound = minBound;
    }

    return {
      minBound,
      maxBound,
    };
  }

  private getNumericConstraintValue(path?: string): number | undefined {
    if (!path) {
      return undefined;
    }

    const value = this.getConfigValueFrom(this.config, path);
    return this.toFiniteNumber(value);
  }

  private toFiniteNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private toBoolean(value: unknown): boolean | undefined {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      if (value === 1) return true;
      if (value === 0) return false;
      return undefined;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") {
        return true;
      }

      if (normalized === "false" || normalized === "0") {
        return false;
      }
    }

    return undefined;
  }

  private clampNumberValue(
    value: number,
    minBound?: number,
    maxBound?: number,
  ): number {
    let next = value;

    if (minBound !== undefined && next < minBound) {
      next = minBound;
    }

    if (maxBound !== undefined && next > maxBound) {
      next = maxBound;
    }

    return next;
  }

  async serializeConfig(
    config: Record<string, any>,
  ): Promise<Record<string, any>> {
    const serialized: Record<string, any> = {};

    for (const key of Object.keys(config)) {
      const value = config[key];

      if (value === null || value === undefined) {
        serialized[key] = value;
      } else if (value instanceof HTMLImageElement) {
        const url = value.src || "";
        if (url.startsWith("blob:")) {
          try {
            serialized[key] = await this.blobUrlToDataUrl(url);
          } catch (err) {
            console.warn("Failed to convert blob URL:", err);
            serialized[key] = "";
          }
        } else {
          serialized[key] = url;
        }
      } else if (typeof value === "object" && !Array.isArray(value)) {
        serialized[key] = await this.serializeConfig(value);
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  private async blobUrlToDataUrl(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private getFieldFromPath(path: string): any {
    const parts = path.split(".");
    let current = this.schema;

    for (const part of parts) {
      if (!current) return null;

      if (current[part]) {
        current = current[part];
      } else if (current.fields && current.fields[part]) {
        current = current.fields[part];
      } else {
        return null;
      }
    }

    return current;
  }

  private processField(
    key: string,
    field: any,
    parentPane: any,
    parentConfig: Record<string, any>,
    pathPrefix: string[],
  ) {
    if (field.type === "folder") {
      this.buildFolder(key, field, parentPane, parentConfig, pathPrefix);
    } else {
      this.buildControl(key, field, parentPane, parentConfig, pathPrefix);
    }
  }

  private buildFolder(
    key: string,
    folderSchema: any,
    parentPane: any,
    parentConfig: Record<string, any>,
    pathPrefix: string[],
  ) {
    if (folderSchema.hidden) {
      if (!parentConfig[key]) parentConfig[key] = {};
      return;
    }

    const folder = parentPane.addFolder({
      title: folderSchema.title || key,
      expanded: folderSchema.expanded ?? true,
    });

    const currentPath = [...pathPrefix, key].join(".");
    this.controlsMap.set(currentPath, folder);

    if (!parentConfig[key]) {
      parentConfig[key] = {};
    }

    if (folderSchema.fields) {
      Object.keys(folderSchema.fields).forEach((fieldKey) => {
        const field = folderSchema.fields[fieldKey];
        this.processField(fieldKey, field, folder, parentConfig[key], [
          ...pathPrefix,
          key,
        ]);
      });
    }
  }

  private buildControl(
    key: string,
    field: any,
    parentPane: any,
    parentConfig: Record<string, any>,
    pathPrefix: string[],
  ) {
    if (field.hidden) {
      if (parentConfig[key] === undefined && field.default !== undefined) {
        parentConfig[key] = field.default;
      }
      return;
    }

    const options: any = {
      label: field.label || key,
    };

    if (parentConfig[key] === undefined && field.default !== undefined) {
      parentConfig[key] = field.default;
    }

    let control: any = null;

    switch (field.type) {
      case "string":
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "number":
        {
          const { minBound, maxBound } = this.getNumberBounds(field);
          if (minBound !== undefined) options.min = minBound;
          if (maxBound !== undefined) options.max = maxBound;
        }
        options.step = field.step ?? 1;
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "boolean":
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "color":
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "image":
        options.view = "input-image";
        if (field.placeholder) {
          options.placeholder = field.placeholder;
        }
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "select":
        if (field.options) {
          options.options = field.options.reduce((acc: any, opt: any) => {
            acc[opt] = opt;
            return acc;
          }, {});
        }
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      default:
        console.warn(`Unknown field type: ${field.type} for key: ${key}`);
    }

    if (control) {
      if (field.readOnly) {
        control.disabled = true;
      }
      const currentPath = [...pathPrefix, key].join(".");
      this.controlsMap.set(currentPath, control);
    }
  }
}
