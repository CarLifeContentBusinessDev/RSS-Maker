import { generateRssXml } from "./../../src/utils/rssGenerator";
import type { ScheduleItem } from "./../../src/types/scheduleItem.ts";
import { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const plainTextHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
};

export const handler: Handler = async (event: HandlerEvent) => {
  const supabaseUrl = (
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  )?.trim();
  const supabaseAnonKey = (
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  )?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      statusCode: 500,
      headers: plainTextHeaders,
      body: "Supabase 환경변수가 없습니다. SUPABASE_URL, SUPABASE_ANON_KEY를 설정해 주세요.",
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const pathParts = event.path.split("/");
  const lastPathPart = pathParts[pathParts.length - 1];
  const idFromPath = lastPathPart && lastPathPart !== "rss" ? lastPathPart : "";
  const idFromQuery = event.queryStringParameters?.id?.trim() ?? "";
  const id = idFromPath || idFromQuery;

  if (!id) {
    return {
      statusCode: 400,
      headers: plainTextHeaders,
      body: "채널 id가 필요합니다.",
    };
  }

  const { data: channel, error } = await supabase
    .from("channels")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !channel) {
    return {
      statusCode: 404,
      headers: plainTextHeaders,
      body: "해당 채널을 찾을 수 없습니다.",
    };
  }

  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstMinute = now.getUTCMinutes();
  const nowMinutes = kstHour * 60 + kstMinute;

  const startMinutes = (p: ScheduleItem): number => {
    const minute = Math.max(0, Math.min(59, Number(p.startMinute ?? 0)));
    return Math.max(0, Number(p.startHour ?? 0) * 60 + minute);
  };

  const endMinutes = (p: ScheduleItem): number => {
    const minute = Math.max(0, Math.min(59, Number(p.endMinute ?? 0)));
    const hour = Number(p.endHour ?? 0);
    if (hour >= 24) return 1440;
    return Math.max(0, hour * 60 + minute);
  };

  const currentProgram = Array.isArray(channel.schedule)
    ? channel.schedule.find((p: ScheduleItem) => {
        const start = startMinutes(p);
        const end = endMinutes(p);
        if (start < end) {
          return nowMinutes >= start && nowMinutes < end;
        } else {
          return nowMinutes >= start || nowMinutes < end;
        }
      }) || channel.schedule[0]
    : { title: channel.title, desc: channel.description };

  const rssXml = generateRssXml(channel, id, currentProgram, now);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
    body: rssXml,
  };
};
