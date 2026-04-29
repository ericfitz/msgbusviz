export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function jitterRgb(hex: string, amount = 12): string {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const expanded = m[1]!.length === 3
    ? m[1]!.split('').map((c) => c + c).join('')
    : m[1]!;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  const dr = Math.round((Math.random() - 0.5) * 2 * amount);
  const dg = Math.round((Math.random() - 0.5) * 2 * amount);
  const db = Math.round((Math.random() - 0.5) * 2 * amount);
  return '#' + [r + dr, g + dg, b + db]
    .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
    .join('');
}

export function jitterVec(amount = 0.05): [number, number, number] {
  return [
    (Math.random() - 0.5) * 2 * amount,
    (Math.random() - 0.5) * 2 * amount,
    (Math.random() - 0.5) * 2 * amount,
  ];
}

export function wanderOffset(t: number, maxAmount = 0.3): [number, number, number] {
  const damp = (1 - t) * (1 - t);
  const a = maxAmount * damp;
  return [
    (Math.random() - 0.5) * 2 * a,
    (Math.random() - 0.5) * 2 * a,
    (Math.random() - 0.5) * 2 * a,
  ];
}
