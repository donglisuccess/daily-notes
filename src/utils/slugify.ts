const NON_WORD = /[^\p{Letter}\p{Number}\s-]/gu;
const WHITESPACE = /\s+/g;

function normalize(value: string): string {
  const base = value
    .normalize('NFKD')
    .replace(NON_WORD, '')
    .trim()
    .replace(WHITESPACE, '-');
  return base.toLowerCase() || 'section';
}

export function createSlugGenerator() {
  const counter = new Map<string, number>();
  return (value: string): string => {
    const base = normalize(value);
    const count = counter.get(base) ?? 0;
    counter.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}
