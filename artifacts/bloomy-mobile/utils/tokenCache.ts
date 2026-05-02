import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const inMemoryCache: Record<string, string> = {};

export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return inMemoryCache[key] ?? null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      inMemoryCache[key] = value;
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore
    }
  },
  async clearToken(key: string): Promise<void> {
    if (Platform.OS === "web") {
      delete inMemoryCache[key];
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};
