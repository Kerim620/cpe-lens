export interface RememberedCredentials {
  address: string;
  username: string;
  password: string;
}

const STORAGE_KEY = "cpe-lens.remembered-credentials";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadRememberedCredentials(): RememberedCredentials | null {
  const target = storage();
  if (!target) return null;
  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedCredentials>;
    if (
      typeof parsed.address !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.password !== "string"
    ) {
      return null;
    }
    return { address: parsed.address, username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}

export function saveRememberedCredentials(values: RememberedCredentials): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Storage can be unavailable or full; connecting still works.
  }
}

export function clearRememberedCredentials(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
