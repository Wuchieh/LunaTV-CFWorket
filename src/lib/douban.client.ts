import { DoubanItem, DoubanResult } from "./types";

interface DoubanCategoriesParams {
  kind: "tv" | "movie";
  category: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

interface DoubanCategoryApiResponse {
  total: number;
  items: Array<{
    id: string;
    title: string;
    card_subtitle: string;
    pic: {
      large: string;
      normal: string;
    };
    rating: {
      value: number;
    };
  }>;
}

interface DoubanListApiResponse {
  total: number;
  subjects: Array<{
    id: string;
    title: string;
    card_subtitle: string;
    cover: string;
    rate: string;
  }>;
}

interface DoubanRecommendApiResponse {
  total: number;
  items: Array<{
    id: string;
    title: string;
    year: string;
    type: string;
    pic: {
      large: string;
      normal: string;
    };
    rating: {
      value: number;
    };
  }>;
}

async function fetchWithTimeout(
  url: string,
  proxyUrl: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const finalUrl =
    proxyUrl === "https://cors-anywhere.com/"
      ? `${proxyUrl}${url}`
      : proxyUrl
      ? `${proxyUrl}${encodeURIComponent(url)}`
      : url;

  const fetchOptions: RequestInit = {
    signal: controller.signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      Referer: "https://movie.douban.com/",
      Accept: "application/json, text/plain, */*",
    },
  };

  try {
    const response = await fetch(finalUrl, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function getDoubanProxyConfig(): {
  proxyType:
    | "direct"
    | "cors-proxy-zwei"
    | "cmliussss-cdn-tencent"
    | "cmliussss-cdn-ali"
    | "cors-anywhere"
    | "custom";
  proxyUrl: string;
} {
  const doubanDataSourceStorage =
    typeof window !== "undefined"
      ? localStorage.getItem("doubanDataSource")
      : null;
  const doubanProxyTypeConfig =
    typeof window !== "undefined"
      ? window.RUNTIME_CONFIG?.DOUBAN_PROXY_TYPE
      : undefined;
  const doubanProxyType =
    doubanDataSourceStorage || doubanProxyTypeConfig || "cmliussss-cdn-tencent";
  const doubanProxyStorage =
    typeof window !== "undefined"
      ? localStorage.getItem("doubanProxyUrl")
      : null;
  const doubanProxyConfig =
    typeof window !== "undefined"
      ? window.RUNTIME_CONFIG?.DOUBAN_PROXY
      : undefined;
  const doubanProxy = doubanProxyStorage || doubanProxyConfig || "";
  return {
    proxyType: doubanProxyType as
      | "direct"
      | "cors-proxy-zwei"
      | "cmliussss-cdn-tencent"
      | "cmliussss-cdn-ali"
      | "cors-anywhere"
      | "custom",
    proxyUrl: doubanProxy,
  };
}

export async function fetchDoubanCategories(
  params: DoubanCategoriesParams,
  proxyUrl: string,
  useTencentCDN = false,
  useAliCDN = false
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;

  if (!["tv", "movie"].includes(kind)) {
    throw new Error("kind 参数必须是 tv 或 movie");
  }

  if (!category || !type) {
    throw new Error("category 和 type 参数不能为空");
  }

  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error("pageLimit 必须在 1-100 之间");
  }

  if (pageStart < 0) {
    throw new Error("pageStart 不能小于 0");
  }

  const target = useTencentCDN
    ? `https://m.douban.cmliussss.net/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`
    : useAliCDN
    ? `https://m.douban.cmliussss.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`
    : `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;

  try {
    const response = await fetchWithTimeout(
      target,
      useTencentCDN || useAliCDN ? "" : proxyUrl
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanCategoryApiResponse = await response.json();

    const list: DoubanItem[] = doubanData.items.map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || "",
      rate: item.rating?.value ? item.rating.value.toFixed(1) : "",
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || "",
    }));

    return {
      code: 200,
      message: "获取成功",
      list: list,
    };
  } catch (error) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("globalError", {
          detail: { message: "获取豆瓣分类数据失败" },
        })
      );
    }
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}

export async function getDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { proxyType, proxyUrl } = getDoubanProxyConfig();
  switch (proxyType) {
    case "cors-proxy-zwei":
      return fetchDoubanCategories(params, "https://ciao-cors.is-an.org/");
    case "cmliussss-cdn-tencent":
      return fetchDoubanCategories(params, "", true, false);
    case "cmliussss-cdn-ali":
      return fetchDoubanCategories(params, "", false, true);
    case "cors-anywhere":
      return fetchDoubanCategories(params, "https://cors-anywhere.com/");
    case "custom":
      return fetchDoubanCategories(params, proxyUrl);
    case "direct":
    default: {
      const response = await fetch(
        `/api/douban/categories?kind=${params.kind}&category=${params.category}&type=${params.type}&limit=${params.pageLimit}&start=${params.pageStart}`
      );
      return response.json();
    }
  }
}

interface DoubanListParams {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

export async function getDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  const { proxyType, proxyUrl } = getDoubanProxyConfig();
  switch (proxyType) {
    case "cors-proxy-zwei":
      return fetchDoubanList(params, "https://ciao-cors.is-an.org/");
    case "cmliussss-cdn-tencent":
      return fetchDoubanList(params, "", true, false);
    case "cmliussss-cdn-ali":
      return fetchDoubanList(params, "", false, true);
    case "cors-anywhere":
      return fetchDoubanList(params, "https://cors-anywhere.com/");
    case "custom":
      return fetchDoubanList(params, proxyUrl);
    case "direct":
    default: {
      const response = await fetch(
        `/api/douban?tag=${params.tag}&type=${params.type}&pageSize=${params.pageLimit}&pageStart=${params.pageStart}`
      );
      return response.json();
    }
  }
}

export async function fetchDoubanList(
  params: DoubanListParams,
  proxyUrl: string,
  useTencentCDN = false,
  useAliCDN = false
): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;

  if (!tag || !type) {
    throw new Error("tag 和 type 参数不能为空");
  }

  if (!["tv", "movie"].includes(type)) {
    throw new Error("type 参数必须是 tv 或 movie");
  }

  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error("pageLimit 必须在 1-100 之间");
  }

  if (pageStart < 0) {
    throw new Error("pageStart 不能小于 0");
  }

  const target = useTencentCDN
    ? `https://movie.douban.cmliussss.net/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`
    : useAliCDN
    ? `https://movie.douban.cmliussss.com/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`
    : `https://movie.douban.com/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;

  try {
    const response = await fetchWithTimeout(
      target,
      useTencentCDN || useAliCDN ? "" : proxyUrl
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanListApiResponse = await response.json();

    const list: DoubanItem[] = doubanData.subjects.map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.cover,
      rate: item.rate,
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || "",
    }));

    return {
      code: 200,
      message: "获取成功",
      list: list,
    };
  } catch (error) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("globalError", {
          detail: { message: "获取豆瓣列表数据失败" },
        })
      );
    }
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}

interface DoubanRecommendsParams {
  kind: "tv" | "movie";
  pageLimit?: number;
  pageStart?: number;
  category?: string;
  format?: string;
  label?: string;
  region?: string;
  year?: string;
  platform?: string;
  sort?: string;
}

export async function getDoubanRecommends(
  params: DoubanRecommendsParams
): Promise<DoubanResult> {
  const { kind, pageLimit = 20, pageStart = 0 } = params;
  const { proxyType, proxyUrl } = getDoubanProxyConfig();
  switch (proxyType) {
    case "cors-proxy-zwei":
      return fetchDoubanRecommends(params, "https://ciao-cors.is-an.org/");
    case "cmliussss-cdn-tencent":
      return fetchDoubanRecommends(params, "", true, false);
    case "cmliussss-cdn-ali":
      return fetchDoubanRecommends(params, "", false, true);
    case "cors-anywhere":
      return fetchDoubanRecommends(params, "https://cors-anywhere.com/");
    case "custom":
      return fetchDoubanRecommends(params, proxyUrl);
    case "direct":
    default: {
      const searchParams = new URLSearchParams();
      searchParams.set("kind", kind);
      searchParams.set("limit", String(pageLimit));
      searchParams.set("start", String(pageStart));
      if (params.category) searchParams.set("category", params.category);
      if (params.format) searchParams.set("format", params.format);
      if (params.label) searchParams.set("label", params.label);
      if (params.region) searchParams.set("region", params.region);
      if (params.year) searchParams.set("year", params.year);
      if (params.platform) searchParams.set("platform", params.platform);
      if (params.sort) searchParams.set("sort", params.sort);
      const response = await fetch(
        `/api/douban/recommends?${searchParams.toString()}`
      );
      return response.json();
    }
  }
}

async function fetchDoubanRecommends(
  params: DoubanRecommendsParams,
  proxyUrl: string,
  useTencentCDN = false,
  useAliCDN = false
): Promise<DoubanResult> {
  const { kind, pageLimit = 20, pageStart = 0 } = params;
  let { category, format, region, year, platform, sort, label } = params;
  if (category === "all") category = "";
  if (format === "all") format = "";
  if (label === "all") label = "";
  if (region === "all") region = "";
  if (year === "all") year = "";
  if (platform === "all") platform = "";
  if (sort === "T") sort = "";

  const selectedCategories = { 类型: category } as Record<string, string>;
  if (format) selectedCategories["形式"] = format;
  if (region) selectedCategories["地区"] = region;

  const tags: string[] = [];
  if (category) tags.push(category);
  if (!category && format) tags.push(format);
  if (label) tags.push(label);
  if (region) tags.push(region);
  if (year) tags.push(year);
  if (platform) tags.push(platform);

  const baseUrl = useTencentCDN
    ? `https://m.douban.cmliussss.net/rexxar/api/v2/${kind}/recommend`
    : useAliCDN
    ? `https://m.douban.cmliussss.com/rexxar/api/v2/${kind}/recommend`
    : `https://m.douban.com/rexxar/api/v2/${kind}/recommend`;
  const reqParams = new URLSearchParams();
  reqParams.append("refresh", "0");
  reqParams.append("start", pageStart.toString());
  reqParams.append("count", pageLimit.toString());
  reqParams.append("selected_categories", JSON.stringify(selectedCategories));
  reqParams.append("uncollect", "false");
  reqParams.append("score_range", "0,10");
  reqParams.append("tags", tags.join(","));
  if (sort) reqParams.append("sort", sort);
  const target = `${baseUrl}?${reqParams.toString()}`;

  try {
    const response = await fetchWithTimeout(
      target,
      useTencentCDN || useAliCDN ? "" : proxyUrl
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanRecommendApiResponse = await response.json();
    const list: DoubanItem[] = doubanData.items
      .filter((item) => item.type == "movie" || item.type == "tv")
      .map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.pic?.normal || item.pic?.large || "",
        rate: item.rating?.value ? item.rating.value.toFixed(1) : "",
        year: item.year,
      }));

    return {
      code: 200,
      message: "获取成功",
      list: list,
    };
  } catch (error) {
    throw new Error(`获取豆瓣推荐数据失败: ${(error as Error).message}`);
  }
}
