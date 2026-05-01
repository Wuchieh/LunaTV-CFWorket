import { NextRequest, NextResponse } from "next/server";

import { getConfig } from "@/lib/config";
import { CURRENT_VERSION } from "@/lib/version";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = await getConfig();
  const result = {
    SiteName: config.SiteConfig.SiteName,
    StorageType: process.env.STORAGE_TYPE || "localstorage",
    Version: CURRENT_VERSION,
  };
  return NextResponse.json(result);
}
