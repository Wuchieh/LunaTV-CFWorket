import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { AdminConfig } from "./admin.types";
import type { Favorite, IStorage, PlayRecord, SkipConfig } from "./types";

export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`;
}

export function parseStorageKey(
  key: string
): { source: string; id: string } | null {
  const idx = key.indexOf("+");
  if (idx === -1 || idx === 0 || idx === key.length - 1) return null;
  return { source: key.substring(0, idx), id: key.substring(idx + 1) };
}

export function getSearchParam(url: string, name: string): string | null {
  const qIdx = url.indexOf("?");
  if (qIdx === -1) return null;
  const query = url.slice(qIdx + 1);
  const hIdx = query.indexOf("#");
  const qs = hIdx === -1 ? query : query.slice(0, hIdx);
  for (const part of qs.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (decodeURIComponent(part.slice(0, eq)) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

export class DbManager {
  private storage: IStorage;

  constructor() {
    this.storage = createStorage();
  }

  async getPlayRecord(
    userName: string,
    source: string,
    id: string
  ): Promise<PlayRecord | null> {
    const key = generateStorageKey(source, id);
    return this.storage.getPlayRecord(userName, key);
  }

  async savePlayRecord(
    userName: string,
    source: string,
    id: string,
    record: PlayRecord
  ): Promise<void> {
    const key = generateStorageKey(source, id);
    await this.storage.setPlayRecord(userName, key, record);
  }

  async getAllPlayRecords(userName: string): Promise<{
    [key: string]: PlayRecord;
  }> {
    return this.storage.getAllPlayRecords(userName);
  }

  async deletePlayRecord(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    const key = generateStorageKey(source, id);
    await this.storage.deletePlayRecord(userName, key);
  }

  async deleteAllPlayRecords(userName: string): Promise<void> {
    await this.storage.deleteAllPlayRecords(userName);
  }

  async getFavorite(
    userName: string,
    source: string,
    id: string
  ): Promise<Favorite | null> {
    const key = generateStorageKey(source, id);
    return this.storage.getFavorite(userName, key);
  }

  async saveFavorite(
    userName: string,
    source: string,
    id: string,
    favorite: Favorite
  ): Promise<void> {
    const key = generateStorageKey(source, id);
    await this.storage.setFavorite(userName, key, favorite);
  }

  async getAllFavorites(
    userName: string
  ): Promise<{ [key: string]: Favorite }> {
    return this.storage.getAllFavorites(userName);
  }

  async deleteFavorite(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    const key = generateStorageKey(source, id);
    await this.storage.deleteFavorite(userName, key);
  }

  async deleteAllFavorites(userName: string): Promise<void> {
    await this.storage.deleteAllFavorites(userName);
  }

  async isFavorited(
    userName: string,
    source: string,
    id: string
  ): Promise<boolean> {
    const favorite = await this.getFavorite(userName, source, id);
    return favorite !== null;
  }

  async registerUser(userName: string, password: string): Promise<void> {
    await this.storage.registerUser(userName, password);
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    return this.storage.verifyUser(userName, password);
  }

  async checkUserExist(userName: string): Promise<boolean> {
    return this.storage.checkUserExist(userName);
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    await this.storage.changePassword(userName, newPassword);
  }

  async deleteUser(userName: string): Promise<void> {
    await this.storage.deleteUser(userName);
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    return this.storage.getSearchHistory(userName);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    await this.storage.addSearchHistory(userName, keyword);
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    await this.storage.deleteSearchHistory(userName, keyword);
  }

  async getAllUsers(): Promise<string[]> {
    if (typeof (this.storage as any).getAllUsers === "function") {
      return (this.storage as any).getAllUsers();
    }
    return [];
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    if (typeof (this.storage as any).getAdminConfig === "function") {
      return (this.storage as any).getAdminConfig();
    }
    return null;
  }

  async saveAdminConfig(config: AdminConfig): Promise<void> {
    if (typeof (this.storage as any).setAdminConfig === "function") {
      await (this.storage as any).setAdminConfig(config);
    }
  }

  async getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<SkipConfig | null> {
    if (typeof (this.storage as any).getSkipConfig === "function") {
      return (this.storage as any).getSkipConfig(userName, source, id);
    }
    return null;
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig
  ): Promise<void> {
    if (typeof (this.storage as any).setSkipConfig === "function") {
      await (this.storage as any).setSkipConfig(userName, source, id, config);
    }
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    if (typeof (this.storage as any).deleteSkipConfig === "function") {
      await (this.storage as any).deleteSkipConfig(userName, source, id);
    }
  }

  async getAllSkipConfigs(
    userName: string
  ): Promise<{ [key: string]: SkipConfig }> {
    if (typeof (this.storage as any).getAllSkipConfigs === "function") {
      return (this.storage as any).getAllSkipConfigs(userName);
    }
    return {};
  }

  async clearAllData(): Promise<void> {
    if (typeof (this.storage as any).clearAllData === "function") {
      await (this.storage as any).clearAllData();
    } else {
      throw new Error("存储类型不支持清空数据操作");
    }
  }
}

function createStorage(): IStorage {
  const storageType = process.env.STORAGE_TYPE || "memory";
  if (storageType === "kv") {
    return createKvStorage();
  }
  return createMemoryStorage();
}

function createKvStorage(): IStorage {
  let kv: KVNamespace | null = null;
  let kvInitAttempted = false;

  const getKv = (): KVNamespace => {
    if (kv) return kv;
    if (kvInitAttempted) {
      throw new Error("KV not available, cannot continue");
    }
    kvInitAttempted = true;
    const context = getCloudflareContext();
    kv = context.env.LUNATV_KV as KVNamespace;
    return kv;
  };

  const prefix = (type: string, userName?: string, key?: string): string => {
    if (userName && key) return `${type}:${userName}:${key}`;
    if (userName) return `${type}:${userName}:`;
    return `${type}:`;
  };

  return {
    async getPlayRecord(userName, key) {
      const storage = getKv();
      const value = await storage.get(prefix("playrecord", userName, key));
      return value ? JSON.parse(value) : null;
    },
    async setPlayRecord(userName, key, record) {
      const storage = getKv();
      await storage.put(
        prefix("playrecord", userName, key),
        JSON.stringify(record)
      );
    },
    async getAllPlayRecords(userName) {
      const storage = getKv();
      const result: Record<string, PlayRecord> = {};
      const list = await storage.list({
        prefix: prefix("playrecord", userName),
      });
      for (const k of list.keys) {
        const value = await storage.get(k.name);
        if (value) {
          result[k.name.slice(prefix("playrecord", userName).length)] =
            JSON.parse(value);
        }
      }
      return result;
    },
    async deletePlayRecord(userName, key) {
      const storage = getKv();
      await storage.delete(prefix("playrecord", userName, key));
    },
    async deleteAllPlayRecords(userName) {
      const storage = getKv();
      const list = await storage.list({
        prefix: prefix("playrecord", userName),
      });
      await Promise.all(list.keys.map((k) => storage.delete(k.name)));
    },

    async getFavorite(userName, key) {
      const storage = getKv();
      const value = await storage.get(prefix("favorite", userName, key));
      return value ? JSON.parse(value) : null;
    },
    async setFavorite(userName, key, favorite) {
      const storage = getKv();
      await storage.put(
        prefix("favorite", userName, key),
        JSON.stringify(favorite)
      );
    },
    async getAllFavorites(userName) {
      const storage = getKv();
      const result: Record<string, Favorite> = {};
      const list = await storage.list({ prefix: prefix("favorite", userName) });
      for (const k of list.keys) {
        const value = await storage.get(k.name);
        if (value) {
          result[k.name.slice(prefix("favorite", userName).length)] =
            JSON.parse(value);
        }
      }
      return result;
    },
    async deleteFavorite(userName, key) {
      const storage = getKv();
      await storage.delete(prefix("favorite", userName, key));
    },
    async deleteAllFavorites(userName) {
      const storage = getKv();
      const list = await storage.list({ prefix: prefix("favorite", userName) });
      await Promise.all(list.keys.map((k) => storage.delete(k.name)));
    },

    async registerUser(userName, password) {
      const storage = getKv();
      await storage.put(prefix("user", userName), password);
      const users = await this.getAllUsers();
      if (!users.includes(userName)) {
        users.push(userName);
        await storage.put("users", JSON.stringify(users));
      }
    },
    async verifyUser(userName, password) {
      const storage = getKv();
      const stored = await storage.get(prefix("user", userName));
      return stored === password;
    },
    async checkUserExist(userName) {
      const storage = getKv();
      const stored = await storage.get(prefix("user", userName));
      return stored !== null;
    },
    async changePassword(userName, newPassword) {
      const storage = getKv();
      await storage.put(prefix("user", userName), newPassword);
    },
    async deleteUser(userName) {
      const storage = getKv();
      await storage.delete(prefix("user", userName));
      await this.deleteAllPlayRecords(userName);
      await this.deleteAllFavorites(userName);
      await this.deleteSearchHistory(userName);
      const usersStr = await storage.get("users");
      if (usersStr) {
        const users: string[] = JSON.parse(usersStr);
        const filtered = users.filter((u) => u !== userName);
        await storage.put("users", JSON.stringify(filtered));
      }
    },

    async getSearchHistory(userName) {
      const storage = getKv();
      const value = await storage.get(prefix("search", userName));
      return value ? JSON.parse(value) : [];
    },
    async addSearchHistory(userName, keyword) {
      const storage = getKv();
      const history = await this.getSearchHistory(userName);
      const filtered = history.filter((k) => k !== keyword);
      filtered.unshift(keyword);
      if (filtered.length > 20) filtered.length = 20;
      await storage.put(prefix("search", userName), JSON.stringify(filtered));
    },
    async deleteSearchHistory(userName, keyword) {
      const storage = getKv();
      if (keyword) {
        const history = await this.getSearchHistory(userName);
        await storage.put(
          prefix("search", userName),
          JSON.stringify(history.filter((k) => k !== keyword))
        );
      } else {
        await storage.delete(prefix("search", userName));
      }
    },

    async getAllUsers() {
      const storage = getKv();
      const value = await storage.get("users");
      return value ? JSON.parse(value) : [];
    },

    async getAdminConfig() {
      const storage = getKv();
      const value = await storage.get("admin:config");
      return value ? JSON.parse(value) : null;
    },
    async setAdminConfig(config) {
      const storage = getKv();
      await storage.put("admin:config", JSON.stringify(config));
    },

    async getSkipConfig(userName, source, id) {
      const storage = getKv();
      const value = await storage.get(`skip:${userName}:${source}+${id}`);
      return value ? JSON.parse(value) : null;
    },
    async setSkipConfig(userName, source, id, config) {
      const storage = getKv();
      await storage.put(
        `skip:${userName}:${source}+${id}`,
        JSON.stringify(config)
      );
    },
    async deleteSkipConfig(userName, source, id) {
      const storage = getKv();
      await storage.delete(`skip:${userName}:${source}+${id}`);
    },
    async getAllSkipConfigs(userName) {
      const storage = getKv();
      const result: Record<string, SkipConfig> = {};
      const list = await storage.list({ prefix: `skip:${userName}:` });
      for (const k of list.keys) {
        const value = await storage.get(k.name);
        if (value) {
          result[k.name.slice(`skip:${userName}:`.length)] = JSON.parse(value);
        }
      }
      return result;
    },

    async migrateData() {},
    async migratePasswords() {},

    async clearAllData() {
      const storage = getKv();
      const list = await storage.list();
      await Promise.all(list.keys.map((k) => storage.delete(k.name)));
    },
  };
}

function createMemoryStorage(): IStorage {
  const users = new Map<string, string>();
  const playRecords = new Map<string, PlayRecord>();
  const favorites = new Map<string, Favorite>();
  const searchHistory = new Map<string, string[]>();
  const skipConfigs = new Map<string, SkipConfig>();
  let adminConfig: AdminConfig | null = null;

  const userSet = new Set<string>();

  return {
    async getPlayRecord(userName, key) {
      const record = playRecords.get(`${userName}:${key}`);
      return record || null;
    },
    async setPlayRecord(userName, key, record) {
      playRecords.set(`${userName}:${key}`, record);
    },
    async getAllPlayRecords(userName) {
      const result: Record<string, PlayRecord> = {};
      playRecords.forEach((value, key) => {
        if (key.startsWith(`${userName}:`)) {
          result[key.slice(userName.length + 1)] = value;
        }
      });
      return result;
    },
    async deletePlayRecord(userName, key) {
      playRecords.delete(`${userName}:${key}`);
    },
    async deleteAllPlayRecords(userName) {
      const prefix = `${userName}:`;
      Array.from(playRecords.keys()).forEach((key) => {
        if (key.startsWith(prefix)) {
          playRecords.delete(key);
        }
      });
    },

    async getFavorite(userName, key) {
      const fav = favorites.get(`${userName}:${key}`);
      return fav || null;
    },
    async setFavorite(userName, key, favorite) {
      favorites.set(`${userName}:${key}`, favorite);
    },
    async getAllFavorites(userName) {
      const result: Record<string, Favorite> = {};
      favorites.forEach((value, key) => {
        if (key.startsWith(`${userName}:`)) {
          result[key.slice(userName.length + 1)] = value;
        }
      });
      return result;
    },
    async deleteFavorite(userName, key) {
      favorites.delete(`${userName}:${key}`);
    },
    async deleteAllFavorites(userName) {
      const prefix = `${userName}:`;
      Array.from(favorites.keys()).forEach((key) => {
        if (key.startsWith(prefix)) {
          favorites.delete(key);
        }
      });
    },

    async registerUser(userName, password) {
      users.set(userName, password);
      userSet.add(userName);
    },
    async verifyUser(userName, password) {
      const stored = users.get(userName);
      if (!stored) return false;
      return stored === password;
    },
    async checkUserExist(userName) {
      return users.has(userName);
    },
    async changePassword(userName, newPassword) {
      if (users.has(userName)) {
        users.set(userName, newPassword);
      }
    },
    async deleteUser(userName) {
      users.delete(userName);
      userSet.delete(userName);
      const prefix = `${userName}:`;
      Array.from(playRecords.keys()).forEach((key) => {
        if (key.startsWith(prefix)) playRecords.delete(key);
      });
      Array.from(favorites.keys()).forEach((key) => {
        if (key.startsWith(prefix)) favorites.delete(key);
      });
      Array.from(searchHistory.keys()).forEach((key) => {
        if (key.startsWith(prefix)) searchHistory.delete(key);
      });
      Array.from(skipConfigs.keys()).forEach((key) => {
        if (key.startsWith(prefix)) skipConfigs.delete(key);
      });
    },

    async getSearchHistory(userName) {
      return searchHistory.get(userName) || [];
    },
    async addSearchHistory(userName, keyword) {
      const history = searchHistory.get(userName) || [];
      const filtered = history.filter((k) => k !== keyword);
      filtered.unshift(keyword);
      if (filtered.length > 20) filtered.length = 20;
      searchHistory.set(userName, filtered);
    },
    async deleteSearchHistory(userName, keyword) {
      if (keyword) {
        const history = searchHistory.get(userName) || [];
        searchHistory.set(
          userName,
          history.filter((k) => k !== keyword)
        );
      } else {
        searchHistory.delete(userName);
      }
    },

    async getAllUsers() {
      return Array.from(userSet);
    },

    async getAdminConfig() {
      return adminConfig;
    },
    async setAdminConfig(config) {
      adminConfig = config;
    },

    async getSkipConfig(userName, source, id) {
      const key = `${userName}:${source}+${id}`;
      return skipConfigs.get(key) || null;
    },
    async setSkipConfig(userName, source, id, config) {
      const key = `${userName}:${source}+${id}`;
      skipConfigs.set(key, config);
    },
    async deleteSkipConfig(userName, source, id) {
      const key = `${userName}:${source}+${id}`;
      skipConfigs.delete(key);
    },
    async getAllSkipConfigs(userName) {
      const result: Record<string, SkipConfig> = {};
      const prefix = `${userName}:`;
      skipConfigs.forEach((value, key) => {
        if (key.startsWith(prefix)) {
          result[key.slice(prefix.length)] = value;
        }
      });
      return result;
    },

    async clearAllData() {
      users.clear();
      playRecords.clear();
      favorites.clear();
      searchHistory.clear();
      skipConfigs.clear();
      userSet.clear();
      adminConfig = null;
    },
  };
}

export const db = new DbManager();
