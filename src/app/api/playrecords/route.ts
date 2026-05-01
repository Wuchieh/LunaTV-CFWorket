/* eslint-disable no-console */

import { NextRequest, NextResponse } from "next/server";

import { getAuthInfoFromCookie } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { db, getSearchParam, parseStorageKey } from "@/lib/db";
import { PlayRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    // 从 cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封禁
      const user = config.UserConfig.Users.find(
        (u) => u.username === authInfo.username
      );
      if (!user) {
        return NextResponse.json({ error: "用户不存在" }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: "用户已被封禁" }, { status: 401 });
      }
    }

    const records = await db.getAllPlayRecords(authInfo.username);
    return NextResponse.json(records, { status: 200 });
  } catch (err) {
    console.error("获取播放记录失败", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 从 cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封禁
      const user = config.UserConfig.Users.find(
        (u) => u.username === authInfo.username
      );
      if (!user) {
        return NextResponse.json({ error: "用户不存在" }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: "用户已被封禁" }, { status: 401 });
      }
    }

    const body = (await request.json()) as { key: string; record: PlayRecord };
    const { key, record } = body;

    if (!key || !record) {
      return NextResponse.json(
        { error: "Missing key or record" },
        { status: 400 }
      );
    }

    // 验证播放记录数据
    if (!record.title || !record.source_name || record.index < 1) {
      return NextResponse.json(
        { error: "Invalid record data" },
        { status: 400 }
      );
    }

    const parsed = parseStorageKey(key);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid key format" },
        { status: 400 }
      );
    }

    const finalRecord = {
      ...record,
      save_time: record.save_time ?? Date.now(),
    } as PlayRecord;

    await db.savePlayRecord(
      authInfo.username,
      parsed.source,
      parsed.id,
      finalRecord
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("保存播放记录失败", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 从 cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封禁
      const user = config.UserConfig.Users.find(
        (u) => u.username === authInfo.username
      );
      if (!user) {
        return NextResponse.json({ error: "用户不存在" }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: "用户已被封禁" }, { status: 401 });
      }
    }

    const username = authInfo.username;
    const rawUrl = request.url;
    const key = getSearchParam(rawUrl, "key");

    if (key) {
      const parsed = parseStorageKey(key);
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid key format" },
          { status: 400 }
        );
      }

      await db.deletePlayRecord(username, parsed.source, parsed.id);
    } else {
      // 未提供 key，则清空全部播放记录
      await db.deleteAllPlayRecords(username);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("删除播放记录失败", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
