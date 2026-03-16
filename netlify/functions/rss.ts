import { ScheduleItem } from "./../../src/types/scheduleItem";
import { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const plainTextHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
};

export const handler: Handler = async (event: HandlerEvent) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();

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

  const currentProgram = Array.isArray(channel.schedule)
    ? channel.schedule.find((p: ScheduleItem) => {
        if (p.startHour < p.endHour) {
          return kstHour >= p.startHour && kstHour < p.endHour;
        } else {
          return kstHour >= p.startHour || kstHour < p.endHour;
        }
      }) || channel.schedule[0]
    : { title: channel.title, desc: channel.description };

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PICKLE LIVE - ${channel.title}</title>
    <link>https://your-site.com/rss/${id}</link>
    <description>${channel.description || "실시간 스트리밍 피드"}</description>
    <item>
      <title>[LIVE] ${currentProgram.title}</title>
      <description>${currentProgram.desc || currentProgram.description}</description>
      <enclosure url="${channel.stream_url}" length="0" type="application/x-mpegURL" />
      <pubDate>${now.toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

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
