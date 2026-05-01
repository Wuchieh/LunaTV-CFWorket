"use client";

import { CURRENT_VERSION } from "@/lib/version";

export enum UpdateStatus {
  HAS_UPDATE = "has_update",
  NO_UPDATE = "no_update",
  FETCH_FAILED = "fetch_failed",
}

const VERSION_CHECK_URLS = [
  "https://raw.githubusercontent.com/MoonTechLab/LunaTV/main/VERSION.txt",
];

export async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    const primaryVersion = await fetchVersionFromUrl(VERSION_CHECK_URLS[0]);
    if (primaryVersion) {
      return compareVersions(primaryVersion);
    }

    const backupVersion = await fetchVersionFromUrl(VERSION_CHECK_URLS[1]);
    if (backupVersion) {
      return compareVersions(backupVersion);
    }

    return UpdateStatus.FETCH_FAILED;
  } catch (error) {
    console.error("版本检查失败:", error);
    return UpdateStatus.FETCH_FAILED;
  }
}

async function fetchVersionFromUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const timestamp = Date.now();
    const urlWithTimestamp = url.includes("?")
      ? `${url}&_t=${timestamp}`
      : `${url}?_t=${timestamp}`;

    const response = await fetch(urlWithTimestamp, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Content-Type": "text/plain",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const version = await response.text();
    return version.trim();
  } catch (error) {
    console.warn(`从 ${url} 获取版本信息失败:`, error);
    return null;
  }
}

export function compareVersions(remoteVersion: string): UpdateStatus {
  if (remoteVersion === CURRENT_VERSION) {
    return UpdateStatus.NO_UPDATE;
  }

  try {
    const currentParts = CURRENT_VERSION.split(".").map((part) => {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`无效的版本号格式: ${CURRENT_VERSION}`);
      }
      return num;
    });

    const remoteParts = remoteVersion.split(".").map((part) => {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`无效的版本号格式: ${remoteVersion}`);
      }
      return num;
    });

    const normalizeVersion = (parts: number[]) => {
      if (parts.length >= 3) {
        return parts.slice(0, 3);
      } else {
        const normalized = [...parts];
        while (normalized.length < 3) {
          normalized.push(0);
        }
        return normalized;
      }
    };

    const normalizedCurrent = normalizeVersion(currentParts);
    const normalizedRemote = normalizeVersion(remoteParts);

    for (let i = 0; i < 3; i++) {
      if (normalizedRemote[i] > normalizedCurrent[i]) {
        return UpdateStatus.HAS_UPDATE;
      } else if (normalizedRemote[i] < normalizedCurrent[i]) {
        return UpdateStatus.NO_UPDATE;
      }
    }

    return UpdateStatus.NO_UPDATE;
  } catch (error) {
    console.error("版本号比较失败:", error);
    return remoteVersion !== CURRENT_VERSION
      ? UpdateStatus.HAS_UPDATE
      : UpdateStatus.NO_UPDATE;
  }
}
