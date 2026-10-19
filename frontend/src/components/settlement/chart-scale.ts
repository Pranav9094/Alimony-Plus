export interface ChartDomain {
  min: number;
  max: number;
}

export interface ChartTick {
  value: number;
  label: string;
}

export interface BarGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChartScaleOptions {
  min?: number;
  max?: number;
  targetTicks?: number;
}

const DEFAULT_TARGET_TICKS = 5;
const MIN_TICK_COUNT = 2;
const MAX_TICK_COUNT = 12;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

export function clamp(value: number, min: number, max: number): number {
  assertFinite(value, "value");
  assertFinite(min, "min");
  assertFinite(max, "max");

  if (min > max) {
    throw new RangeError("min cannot be greater than max");
  }

  return Math.min(max, Math.max(min, value));
}

export function getChartDomain(
  values: readonly number[],
  options: ChartScaleOptions = {},
): ChartDomain {
  const validValues = values.map((value) => {
    assertFinite(value, "Chart value");
    return value;
  });

  const dataMin = validValues.length > 0 ? Math.min(...validValues) : 0;

  const dataMax = validValues.length > 0 ? Math.max(...validValues) : 0;

  const min = options.min ?? Math.min(0, dataMin);
  const max = options.max ?? Math.max(0, dataMax);

  assertFinite(min, "min");
  assertFinite(max, "max");

  if (min > max) {
    throw new RangeError("min cannot be greater than max");
  }

  if (min === max) {
    const padding = Math.abs(min) * 0.1 || 1;

    return {
      min: min - padding,
      max: max + padding,
    };
  }

  return { min, max };
}

export function niceStep(
  range: number,
  targetTicks = DEFAULT_TARGET_TICKS,
): number {
  assertFinite(range, "range");
  assertFinite(targetTicks, "targetTicks");

  if (range <= 0) {
    throw new RangeError("range must be greater than zero");
  }

  if (
    !Number.isInteger(targetTicks) ||
    targetTicks < MIN_TICK_COUNT ||
    targetTicks > MAX_TICK_COUNT
  ) {
    throw new RangeError(
      `targetTicks must be an integer between ${MIN_TICK_COUNT} and ${MAX_TICK_COUNT}`,
    );
  }

  const roughStep = range / (targetTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  let multiplier: number;

  if (normalized <= 1) {
    multiplier = 1;
  } else if (normalized <= 2) {
    multiplier = 2;
  } else if (normalized <= 2.5) {
    multiplier = 2.5;
  } else if (normalized <= 5) {
    multiplier = 5;
  } else {
    multiplier = 10;
  }

  return multiplier * magnitude;
}

export function getChartTicks(
  domain: ChartDomain,
  targetTicks = DEFAULT_TARGET_TICKS,
  locale = "en-IN",
): ChartTick[] {
  assertFinite(domain.min, "domain.min");
  assertFinite(domain.max, "domain.max");

  if (domain.min >= domain.max) {
    throw new RangeError("domain.min must be less than domain.max");
  }

  const step = niceStep(domain.max - domain.min, targetTicks);
  const first = Math.ceil(domain.min / step);
  const last = Math.floor(domain.max / step);

  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    notation: "compact",
  });

  const ticks: ChartTick[] = [];

  for (let index = first; index <= last; index += 1) {
    const value = Number((index * step).toPrecision(12));

    ticks.push({
      value,
      label: formatter.format(value),
    });
  }

  return ticks;
}

export function valueToY(
  value: number,
  domain: ChartDomain,
  top: number,
  height: number,
): number {
  assertFinite(value, "value");
  assertFinite(top, "top");
  assertFinite(height, "height");

  if (height < 0) {
    throw new RangeError("height cannot be negative");
  }

  if (domain.max <= domain.min) {
    throw new RangeError("Invalid chart domain");
  }

  const ratio = (value - domain.min) / (domain.max - domain.min);

  return top + height * (1 - ratio);
}

export function createBarGeometry(
  value: number,
  domain: ChartDomain,
  x: number,
  width: number,
  top: number,
  height: number,
): BarGeometry {
  assertFinite(value, "value");
  assertFinite(x, "x");
  assertFinite(width, "width");
  assertFinite(top, "top");
  assertFinite(height, "height");

  if (width < 0 || height < 0) {
    throw new RangeError("Bar width and chart height cannot be negative");
  }

  if (domain.max <= domain.min) {
    throw new RangeError("Invalid chart domain");
  }

  const zero = clamp(0, domain.min, domain.max);
  const zeroY = valueToY(zero, domain, top, height);
  const valueY = valueToY(
    clamp(value, domain.min, domain.max),
    domain,
    top,
    height,
  );

  return {
    x,
    y: Math.min(zeroY, valueY),
    width,
    height: Math.abs(zeroY - valueY),
  };
}

export function formatINR(
  value: number,
  options: { compact?: boolean; maximumFractionDigits?: number } = {},
): string {
  assertFinite(value, "value");

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
    notation: options.compact ? "compact" : "standard",
  }).format(value);
}
