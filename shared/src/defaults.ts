import type { RepeatConfig } from "./schemas.js";

export const defaultRepeat = (): RepeatConfig => ({ enabled: false, days: [], end_date: null });
