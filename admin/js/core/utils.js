// MML shared utility bridge
export function uuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `MML-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function deepCopy(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
}
