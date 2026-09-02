// Theme 2 — suppression programmee : delais autorises et validation de la
// valeur envoyee par le client pour "disappearAfterSec".

export const DISAPPEAR_AFTER_OPTIONS_SEC = [30, 300, 3600, 86400, 604800] as const

export type DisappearAfterSec = typeof DISAPPEAR_AFTER_OPTIONS_SEC[number]

function isValidOption(value: number): value is DisappearAfterSec {
  return (DISAPPEAR_AFTER_OPTIONS_SEC as readonly number[]).includes(value)
}

export function parseDisappearAfterSec(input: unknown): DisappearAfterSec | undefined {
  if (input === undefined || input === null || input === '') return undefined
  const value = typeof input === 'string' ? Number(input) : input
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return isValidOption(value) ? value : undefined
  }
