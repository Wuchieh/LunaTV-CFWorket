import { getConfig } from "./config";
import { db } from "./db";

const defaultUA = "AptvPlayer/1.4.10";

export interface LiveChannels {
  channelNumber: number;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
  epgUrl: string;
  epgs: {
    [key: string]: {
      start: string;
      end: string;
      title: string;
    }[];
  };
}

const cachedLiveChannels: { [key: string]: LiveChannels } = {};

export function deleteCachedLiveChannels(key: string) {
  delete cachedLiveChannels[key];
}

export async function getCachedLiveChannels(
  key: string
): Promise<LiveChannels | null> {
  if (!cachedLiveChannels[key]) {
    const config = await getConfig();
    const liveInfo = config.LiveConfig?.find((live) => live.key === key);
    if (!liveInfo) {
      return null;
    }
    const channelNum = await refreshLiveChannels(liveInfo);
    if (channelNum === 0) {
      return null;
    }
    liveInfo.channelNumber = channelNum;
    await db.saveAdminConfig(config);
  }
  return cachedLiveChannels[key] || null;
}

export async function refreshLiveChannels(liveInfo: {
  key: string;
  name: string;
  url: string;
  ua?: string;
  epg?: string;
  from: "config" | "custom";
  channelNumber?: number;
  disabled?: boolean;
}): Promise<number> {
  if (cachedLiveChannels[liveInfo.key]) {
    delete cachedLiveChannels[liveInfo.key];
  }
  const ua = liveInfo.ua || defaultUA;
  const response = await fetch(liveInfo.url, {
    headers: {
      "User-Agent": ua,
    },
  });
  const data = await response.text();
  const result = parseM3U(liveInfo.key, data);
  const epgUrl = liveInfo.epg || result.tvgUrl;
  const epgs = await parseEpg(
    epgUrl,
    liveInfo.ua || defaultUA,
    result.channels.map((channel) => channel.tvgId).filter((tvgId) => tvgId)
  );
  cachedLiveChannels[liveInfo.key] = {
    channelNumber: result.channels.length,
    channels: result.channels,
    epgUrl: epgUrl,
    epgs: epgs,
  };
  return result.channels.length;
}

async function parseEpg(
  epgUrl: string,
  ua: string,
  tvgIds: string[]
): Promise<{
  [key: string]: {
    start: string;
    end: string;
    title: string;
  }[];
}> {
  if (!epgUrl) {
    return {};
  }

  const tvgs = new Set(tvgIds);
  const result: {
    [key: string]: { start: string; end: string; title: string }[];
  } = {};

  try {
    const response = await fetch(epgUrl, {
      headers: {
        "User-Agent": ua,
      },
    });
    if (!response.ok) {
      return {};
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return {};
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let currentTvgId = "";
    let currentProgram: { start: string; end: string; title: string } | null =
      null;
    let shouldSkipCurrentProgram = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith("<programme")) {
          const tvgIdMatch = trimmedLine.match(/channel="([^"]*)"/);
          currentTvgId = tvgIdMatch ? tvgIdMatch[1] : "";

          const startMatch = trimmedLine.match(/start="([^"]*)"/);
          const start = startMatch ? startMatch[1] : "";

          const endMatch = trimmedLine.match(/stop="([^"]*)"/);
          const end = endMatch ? endMatch[1] : "";

          if (currentTvgId && start && end) {
            currentProgram = { start, end, title: "" };
            shouldSkipCurrentProgram = !tvgs.has(currentTvgId);
          }
        } else if (
          trimmedLine.startsWith("<title") &&
          currentProgram &&
          !shouldSkipCurrentProgram
        ) {
          const titleMatch = trimmedLine.match(
            /<title(?:\s+[^>]*)?>(.*?)<\/title>/
          );
          if (titleMatch && currentProgram) {
            currentProgram.title = titleMatch[1];

            if (!result[currentTvgId]) {
              result[currentTvgId] = [];
            }
            result[currentTvgId].push({ ...currentProgram });

            currentProgram = null;
          }
        } else if (trimmedLine === "</programme>") {
          currentProgram = null;
          currentTvgId = "";
          shouldSkipCurrentProgram = false;
        }
      }
    }
  } catch {
    // ignore
  }

  return result;
}

function parseM3U(
  sourceKey: string,
  m3uContent: string
): {
  tvgUrl: string;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
} {
  const channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[] = [];

  const lines = m3uContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let tvgUrl = "";
  let channelIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("#EXTM3U")) {
      const tvgUrlMatch = line.match(/(?:x-tvg-url|url-tvg)="([^"]*)"/);
      tvgUrl = tvgUrlMatch ? tvgUrlMatch[1].split(",")[0].trim() : "";
      continue;
    }

    if (line.startsWith("#EXTINF:")) {
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgId = tvgIdMatch ? tvgIdMatch[1] : "";

      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgName = tvgNameMatch ? tvgNameMatch[1] : "";

      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const logo = tvgLogoMatch ? tvgLogoMatch[1] : "";

      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      const group = groupTitleMatch ? groupTitleMatch[1] : "无分组";

      const titleMatch = line.match(/,([^,]*)$/);
      const title = titleMatch ? titleMatch[1].trim() : "";

      const name = title || tvgName || "";

      if (i + 1 < lines.length && !lines[i + 1].startsWith("#")) {
        const url = lines[i + 1];

        if (name && url) {
          channels.push({
            id: `${sourceKey}-${channelIndex}`,
            tvgId,
            name,
            logo,
            group,
            url,
          });
          channelIndex++;
        }

        i++;
      }
    }
  }

  return { tvgUrl, channels };
}

export function resolveUrl(baseUrl: string, relativePath: string) {
  try {
    if (
      relativePath.startsWith("http://") ||
      relativePath.startsWith("https://")
    ) {
      return relativePath;
    }

    if (relativePath.startsWith("//")) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}${relativePath}`;
    }

    const baseUrlObj = new URL(baseUrl);
    const resolvedUrl = new URL(relativePath, baseUrlObj);
    return resolvedUrl.href;
  } catch {
    return fallbackUrlResolve(baseUrl, relativePath);
  }
}

function fallbackUrlResolve(baseUrl: string, relativePath: string) {
  let base = baseUrl;
  if (!base.endsWith("/")) {
    base = base.substring(0, base.lastIndexOf("/") + 1);
  }

  if (relativePath.startsWith("/")) {
    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}${relativePath}`;
  } else if (relativePath.startsWith("../")) {
    const segments = base.split("/").filter((s) => s);
    const relativeSegments = relativePath.split("/").filter((s) => s);

    for (const segment of relativeSegments) {
      if (segment === "..") {
        segments.pop();
      } else if (segment !== ".") {
        segments.push(segment);
      }
    }

    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}/${segments.join("/")}`;
  } else {
    const cleanRelative = relativePath.startsWith("./")
      ? relativePath.slice(2)
      : relativePath;
    return base + cleanRelative;
  }
}

export function getBaseUrl(m3u8Url: string) {
  try {
    const url = new URL(m3u8Url);
    if (url.pathname.endsWith(".m3u8")) {
      url.pathname = url.pathname.substring(
        0,
        url.pathname.lastIndexOf("/") + 1
      );
    } else if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return url.protocol + "//" + url.host + url.pathname;
  } catch {
    return m3u8Url.endsWith("/") ? m3u8Url : m3u8Url + "/";
  }
}
