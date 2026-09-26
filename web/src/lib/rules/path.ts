/** Read / immutably write a value by fieldKey path, e.g. "rows[3].qualityInitials". */

type Segment = string | number;

export function parsePath(key: string): Segment[] {
  return key
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

export function getIn(obj: unknown, key: string): unknown {
  let cur: unknown = obj;
  for (const seg of parsePath(key)) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<Segment, unknown>)[seg];
  }
  return cur;
}

export function setIn<T>(obj: T, key: string, value: unknown): T {
  const set = (cur: unknown, segs: Segment[]): unknown => {
    if (!segs.length) return value;
    const [seg, ...rest] = segs;
    const src = (cur ?? (typeof seg === 'number' ? [] : {})) as Record<Segment, unknown>;
    const copy = (Array.isArray(src) ? [...src] : { ...src }) as Record<Segment, unknown>;
    copy[seg] = set(src[seg], rest);
    return copy;
  };
  return set(obj, parsePath(key)) as T;
}
