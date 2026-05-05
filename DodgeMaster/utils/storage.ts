import AsyncStorage from '@react-native-async-storage/async-storage';

/** Read a JSON value from storage, returning fallback on any error or miss. */
export async function getItem<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write a JSON value to storage. Silently swallows errors (e.g. storage full). */
export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — game continues without persistence
  }
}
