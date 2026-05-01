import { getAvailableApiSites } from "./config";
import { getDetailFromApi, searchFromApi } from "./downstream";
import { SearchResult } from "./types";

interface FetchVideoDetailOptions {
  source: string;
  id: string;
  fallbackTitle?: string;
}

export async function fetchVideoDetail({
  source,
  id,
  fallbackTitle = "",
}: FetchVideoDetailOptions): Promise<SearchResult> {
  const apiSites = await getAvailableApiSites();
  const apiSite = apiSites.find((site) => site.key === source);
  if (!apiSite) {
    throw new Error("无效的API来源");
  }
  if (fallbackTitle) {
    try {
      const searchData = await searchFromApi(apiSite, fallbackTitle.trim());
      const exactMatch = searchData.find(
        (item: SearchResult) =>
          item.source.toString() === source.toString() &&
          item.id.toString() === id.toString()
      );
      if (exactMatch) {
        return exactMatch;
      }
    } catch {
      // do nothing
    }
  }

  const detail = await getDetailFromApi(apiSite, id);
  if (!detail) {
    throw new Error("获取视频详情失败");
  }

  return detail;
}
