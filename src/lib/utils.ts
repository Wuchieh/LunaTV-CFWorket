import he from "he";
import Hls from "hls.js";

declare global {
  interface Window {
    RUNTIME_CONFIG?: {
      DOUBAN_IMAGE_PROXY_TYPE?: string;
      DOUBAN_IMAGE_PROXY?: string;
      DOUBAN_PROXY_TYPE?: string;
      DOUBAN_PROXY?: string;
    };
  }
}

function getDoubanImageProxyConfig(): {
  proxyType:
    | "server"
    | "cmliussss-cdn-tencent"
    | "cmliussss-cdn-ali"
    | "custom";
  proxyUrl: string;
} {
  const fromStorage =
    typeof window !== "undefined"
      ? localStorage.getItem("doubanImageProxyType")
      : null;
  const fromConfig =
    typeof window !== "undefined"
      ? window.RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE
      : undefined;
  let doubanImageProxyType =
    fromStorage || fromConfig || "cmliussss-cdn-tencent";
  if (doubanImageProxyType === "direct" || doubanImageProxyType === "img3") {
    doubanImageProxyType = "server";
  }
  const doubanImageProxyStorage =
    typeof window !== "undefined"
      ? localStorage.getItem("doubanImageProxyUrl")
      : null;
  const doubanImageProxyConfig =
    typeof window !== "undefined"
      ? window.RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY
      : undefined;
  const doubanImageProxy =
    doubanImageProxyStorage || doubanImageProxyConfig || "";
  return {
    proxyType: doubanImageProxyType as
      | "server"
      | "cmliussss-cdn-tencent"
      | "cmliussss-cdn-ali"
      | "custom",
    proxyUrl: doubanImageProxy,
  };
}

export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  if (!originalUrl.includes("doubanio.com")) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  switch (proxyType) {
    case "server":
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case "cmliussss-cdn-tencent":
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        "img.doubanio.cmliussss.net"
      );
    case "cmliussss-cdn-ali":
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        "img.doubanio.cmliussss.com"
      );
    case "custom":
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    default:
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
  }
}

export async function getVideoResolutionFromM3u8(m3u8Url: string): Promise<{
  quality: string;
  loadSpeed: string;
  pingTime: number;
}> {
  try {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "metadata";

      const pingStart = performance.now();
      let pingTime = 0;

      fetch(m3u8Url, { method: "HEAD", mode: "no-cors" })
        .then(() => {
          pingTime = performance.now() - pingStart;
        })
        .catch(() => {
          pingTime = performance.now() - pingStart;
        });

      const hls = new Hls();

      const timeout = setTimeout(() => {
        hls.destroy();
        video.remove();
        reject(new Error("Timeout loading video metadata"));
      }, 4000);

      video.onerror = () => {
        clearTimeout(timeout);
        hls.destroy();
        video.remove();
        reject(new Error("Failed to load video metadata"));
      };

      let actualLoadSpeed = "未知";
      let hasSpeedCalculated = false;
      let hasMetadataLoaded = false;

      let fragmentStartTime = 0;

      const checkAndResolve = () => {
        if (
          hasMetadataLoaded &&
          (hasSpeedCalculated || actualLoadSpeed !== "未知")
        ) {
          clearTimeout(timeout);
          const width = video.videoWidth;
          if (width && width > 0) {
            hls.destroy();
            video.remove();

            const quality =
              width >= 3840
                ? "4K"
                : width >= 2560
                ? "2K"
                : width >= 1920
                ? "1080p"
                : width >= 1280
                ? "720p"
                : width >= 854
                ? "480p"
                : "SD";

            resolve({
              quality,
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          } else {
            resolve({
              quality: "未知",
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          }
        }
      };

      hls.on(Hls.Events.FRAG_LOADING, () => {
        fragmentStartTime = performance.now();
      });

      hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
        if (
          fragmentStartTime > 0 &&
          data &&
          data.payload &&
          !hasSpeedCalculated
        ) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;

          if (loadTime > 0 && size > 0) {
            const speedKBps = size / 1024 / (loadTime / 1000);

            const avgSpeedKBps = speedKBps;

            if (avgSpeedKBps >= 1024) {
              actualLoadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
            } else {
              actualLoadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
            }
            hasSpeedCalculated = true;
            checkAndResolve();
          }
        }
      });

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error("HLS错误:", data);
        if (data.fatal) {
          clearTimeout(timeout);
          hls.destroy();
          video.remove();
          reject(new Error(`HLS播放失败: ${data.type}`));
        }
      });

      video.onloadedmetadata = () => {
        hasMetadataLoaded = true;
        checkAndResolve();
      };
    });
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function cleanHtmlTags(text: string): string {
  if (!text) return "";

  const cleanedText = text
    .replace(/<[^>]+>/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/^\n+|\n+$/g, "")
    .trim();

  return he.decode(cleanedText);
}
