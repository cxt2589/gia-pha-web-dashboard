import type { GenealogyDateStructured } from '../types';

export function normalizeGenealogyDateText(value: unknown): string;
export function parseGenealogyDateText(value: unknown, defaultCalendar?: GenealogyDateStructured['calendar']): GenealogyDateStructured;
export function formatGenealogyDateStructured(date: GenealogyDateStructured | null | undefined): string;
export function convertLunarToSolar(date: {
  day: number;
  month: number;
  lunarYear: number;
  isLeapMonth?: boolean;
}): null;
