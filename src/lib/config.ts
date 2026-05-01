import type { AdminConfig } from "./admin.types";
import { db } from "./db";

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
}

export interface LiveCfg {
  name: string;
  url: string;
  ua?: string;
  epg?: string;
}

interface ConfigFileStruct {
  cache_time?: number;
  api_site?: {
    [key: string]: ApiSite;
  };
  custom_category?: {
    name?: string;
    type: "movie" | "tv";
    query: string;
  }[];
  lives?: {
    [key: string]: LiveCfg;
  };
}

export const API_CONFIG = {
  search: {
    path: "?ac=videolist&wd=",
    pagePath: "?ac=videolist&wd={query}&pg={page}",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  },
  detail: {
    path: "?ac=videolist&ids=",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  },
};

let cachedConfig: AdminConfig | undefined;

export function refineConfig(adminConfig: AdminConfig): AdminConfig {
  let fileConfig: ConfigFileStruct;
  try {
    fileConfig = JSON.parse(adminConfig.ConfigFile) as ConfigFileStruct;
  } catch {
    fileConfig = {} as ConfigFileStruct;
  }

  const apiSitesFromFile = Object.entries(fileConfig.api_site || []);
  const currentApiSites = new Map(
    (adminConfig.SourceConfig || []).map((s) => [s.key, s])
  );

  apiSitesFromFile.forEach(([key, site]) => {
    const existingSource = currentApiSites.get(key);
    if (existingSource) {
      existingSource.name = site.name;
      existingSource.api = site.api;
      existingSource.detail = site.detail;
      existingSource.from = "config";
    } else {
      currentApiSites.set(key, {
        key,
        name: site.name,
        api: site.api,
        detail: site.detail,
        from: "config",
        disabled: false,
      });
    }
  });

  const apiSitesFromFileKey = new Set(apiSitesFromFile.map(([key]) => key));
  currentApiSites.forEach((source) => {
    if (!apiSitesFromFileKey.has(source.key)) {
      source.from = "custom";
    }
  });

  adminConfig.SourceConfig = Array.from(currentApiSites.values());

  const customCategoriesFromFile = fileConfig.custom_category || [];
  const currentCustomCategories = new Map(
    (adminConfig.CustomCategories || []).map((c) => [c.query + c.type, c])
  );

  customCategoriesFromFile.forEach((category) => {
    const key = category.query + category.type;
    const existedCategory = currentCustomCategories.get(key);
    if (existedCategory) {
      existedCategory.name = category.name;
      existedCategory.query = category.query;
      existedCategory.type = category.type;
      existedCategory.from = "config";
    } else {
      currentCustomCategories.set(key, {
        name: category.name,
        type: category.type,
        query: category.query,
        from: "config",
        disabled: false,
      });
    }
  });

  const customCategoriesFromFileKeys = new Set(
    customCategoriesFromFile.map((c) => c.query + c.type)
  );
  currentCustomCategories.forEach((category) => {
    if (!customCategoriesFromFileKeys.has(category.query + category.type)) {
      category.from = "custom";
    }
  });

  adminConfig.CustomCategories = Array.from(currentCustomCategories.values());

  const livesFromFile = Object.entries(fileConfig.lives || []);
  const currentLives = new Map(
    (adminConfig.LiveConfig || []).map((l) => [l.key, l])
  );
  livesFromFile.forEach(([key, site]) => {
    const existingLive = currentLives.get(key);
    if (existingLive) {
      existingLive.name = site.name;
      existingLive.url = site.url;
      existingLive.ua = site.ua;
      existingLive.epg = site.epg;
    } else {
      currentLives.set(key, {
        key,
        name: site.name,
        url: site.url,
        ua: site.ua,
        epg: site.epg,
        channelNumber: 0,
        from: "config",
        disabled: false,
      });
    }
  });

  const livesFromFileKeys = new Set(livesFromFile.map(([key]) => key));
  currentLives.forEach((live) => {
    if (!livesFromFileKeys.has(live.key)) {
      live.from = "custom";
    }
  });

  adminConfig.LiveConfig = Array.from(currentLives.values());

  return adminConfig;
}

async function getInitConfig(
  configFile: string,
  subConfig: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  } = {
    URL: "",
    AutoUpdate: false,
    LastCheck: "",
  }
): Promise<AdminConfig> {
  let cfgFile: ConfigFileStruct;
  try {
    cfgFile = JSON.parse(configFile) as ConfigFileStruct;
  } catch {
    cfgFile = {} as ConfigFileStruct;
  }
  const adminConfig: AdminConfig = {
    ConfigFile: configFile,
    ConfigSubscribtion: subConfig,
    SiteConfig: {
      SiteName: process.env.NEXT_PUBLIC_SITE_NAME || "MoonTV",
      Announcement:
        process.env.ANNOUNCEMENT ||
        "本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。",
      SearchDownstreamMaxPage:
        Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
      SiteInterfaceCacheTime: cfgFile.cache_time || 7200,
      DoubanProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || "cmliussss-cdn-tencent",
      DoubanProxy: process.env.NEXT_PUBLIC_DOUBAN_PROXY || "",
      DoubanImageProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE ||
        "cmliussss-cdn-tencent",
      DoubanImageProxy: process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || "",
      DisableYellowFilter:
        process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === "true",
      FluidSearch: process.env.NEXT_PUBLIC_FLUID_SEARCH !== "false",
      EnableWebLive: false,
    },
    UserConfig: {
      Users: [],
    },
    SourceConfig: [],
    CustomCategories: [],
    LiveConfig: [],
  };

  return adminConfig;
}

export async function getConfig(): Promise<AdminConfig> {
  const storedConfig = await db.getAdminConfig();
  if (storedConfig) {
    cachedConfig = configSelfCheck(storedConfig);
    return cachedConfig;
  }

  if (cachedConfig) {
    return cachedConfig;
  }

  const adminConfig = await getInitConfig("");
  cachedConfig = configSelfCheck(adminConfig);
  return cachedConfig;
}

export function configSelfCheck(adminConfig: AdminConfig): AdminConfig {
  if (!adminConfig.UserConfig) {
    adminConfig.UserConfig = { Users: [] };
  }
  if (
    !adminConfig.UserConfig.Users ||
    !Array.isArray(adminConfig.UserConfig.Users)
  ) {
    adminConfig.UserConfig.Users = [];
  }
  if (!adminConfig.SourceConfig || !Array.isArray(adminConfig.SourceConfig)) {
    adminConfig.SourceConfig = [];
  }
  if (
    !adminConfig.CustomCategories ||
    !Array.isArray(adminConfig.CustomCategories)
  ) {
    adminConfig.CustomCategories = [];
  }
  if (!adminConfig.LiveConfig || !Array.isArray(adminConfig.LiveConfig)) {
    adminConfig.LiveConfig = [];
  }

  const ownerUser = process.env.USERNAME;

  const seenUsernames = new Set<string>();
  adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter((user) => {
    if (seenUsernames.has(user.username)) {
      return false;
    }
    seenUsernames.add(user.username);
    return true;
  });

  const originOwnerCfg = adminConfig.UserConfig.Users.find(
    (u) => u.username === ownerUser
  );
  adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter(
    (user) => user.username !== ownerUser
  );
  adminConfig.UserConfig.Users.forEach((user) => {
    if (user.role === "owner") {
      user.role = "user";
    }
  });
  adminConfig.UserConfig.Users.unshift({
    username: ownerUser!,
    role: "owner",
    banned: false,
    enabledApis: originOwnerCfg?.enabledApis || undefined,
    tags: originOwnerCfg?.tags || undefined,
  });

  const seenSourceKeys = new Set<string>();
  adminConfig.SourceConfig = adminConfig.SourceConfig.filter((source) => {
    if (seenSourceKeys.has(source.key)) {
      return false;
    }
    seenSourceKeys.add(source.key);
    return true;
  });

  const seenCustomCategoryKeys = new Set<string>();
  adminConfig.CustomCategories = adminConfig.CustomCategories.filter(
    (category) => {
      if (seenCustomCategoryKeys.has(category.query + category.type)) {
        return false;
      }
      seenCustomCategoryKeys.add(category.query + category.type);
      return true;
    }
  );

  const seenLiveKeys = new Set<string>();
  adminConfig.LiveConfig = adminConfig.LiveConfig.filter((live) => {
    if (seenLiveKeys.has(live.key)) {
      return false;
    }
    seenLiveKeys.add(live.key);
    return true;
  });

  return adminConfig;
}

export async function resetConfig(): Promise<void> {
  cachedConfig = undefined;
}

export async function getCacheTime(): Promise<number> {
  const config = await getConfig();
  return config.SiteConfig.SiteInterfaceCacheTime || 7200;
}

export async function getAvailableApiSites(user?: string): Promise<ApiSite[]> {
  const config = await getConfig();
  const allApiSites = config.SourceConfig.filter((s) => !s.disabled);

  if (!user) {
    return allApiSites;
  }

  const userConfig = config.UserConfig.Users.find((u) => u.username === user);
  if (!userConfig) {
    return allApiSites;
  }

  if (userConfig.enabledApis && userConfig.enabledApis.length > 0) {
    const userApiSitesSet = new Set(userConfig.enabledApis);
    return allApiSites
      .filter((s) => userApiSitesSet.has(s.key))
      .map((s) => ({
        key: s.key,
        name: s.name,
        api: s.api,
        detail: s.detail,
      }));
  }

  if (userConfig.tags && userConfig.tags.length > 0 && config.UserConfig.Tags) {
    const enabledApisFromTags = new Set<string>();

    userConfig.tags.forEach((tagName) => {
      const tagConfig = config.UserConfig.Tags?.find((t) => t.name === tagName);
      if (tagConfig && tagConfig.enabledApis) {
        tagConfig.enabledApis.forEach((apiKey) =>
          enabledApisFromTags.add(apiKey)
        );
      }
    });

    if (enabledApisFromTags.size > 0) {
      return allApiSites
        .filter((s) => enabledApisFromTags.has(s.key))
        .map((s) => ({
          key: s.key,
          name: s.name,
          api: s.api,
          detail: s.detail,
        }));
    }
  }

  return allApiSites;
}

export function setCachedConfig(config: AdminConfig): void {
  cachedConfig = config;
}
