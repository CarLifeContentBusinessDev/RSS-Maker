import { createClient } from "@supabase/supabase-js";

type QueryValue = string | string[] | undefined;

interface ScheduleItem {
  startHour: number;
  endHour: number;
  title: string;
  desc: string;
}

interface Channel {
  id: string;
  title: string;
  stream_url: string;
  description: string;
  schedule: ScheduleItem[];
}

interface VercelLikeRequest {
  query?: Record<string, QueryValue>;
}

interface VercelLikeResponse {
  setHeader(name: string, value: string): void;
  status(code: number): {
    send(body: string): void;
  };
}

const textHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
};

const xmlHeaders = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const pickFirst = (value: QueryValue): string => {
  if (Array.isArray(value)) {
    return (value[0] ?? "").trim();
  }

  return (value ?? "").trim();
};

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
): Promise<void> {
  const supabaseUrl = (
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  )?.trim();
  const supabaseAnonKey = (
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  )?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    res.setHeader("Content-Type", textHeaders["Content-Type"]);
    res.setHeader(
      "Access-Control-Allow-Origin",
      textHeaders["Access-Control-Allow-Origin"],
    );
    res
      .status(500)
      .send(
        "Supabase 환경변수가 없습니다. SUPABASE_URL, SUPABASE_ANON_KEY를 설정해 주세요.",
      );
    return;
  }

  const id = pickFirst(req.query?.id);

  if (!id) {
    res.setHeader("Content-Type", textHeaders["Content-Type"]);
    res.setHeader(
      "Access-Control-Allow-Origin",
      textHeaders["Access-Control-Allow-Origin"],
    );
    res.status(400).send("채널 id가 필요합니다.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: channel, error } = await supabase
    .from("channels")
    .select("*")
    .eq("id", id)
    .single<Channel>();

  if (error || !channel) {
    res.setHeader("Content-Type", textHeaders["Content-Type"]);
    res.setHeader(
      "Access-Control-Allow-Origin",
      textHeaders["Access-Control-Allow-Origin"],
    );
    res.status(404).send("해당 채널을 찾을 수 없습니다.");
    return;
  }

  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;

  const currentProgram = Array.isArray(channel.schedule)
    ? (channel.schedule.find((item) => {
        if (item.startHour < item.endHour) {
          return kstHour >= item.startHour && kstHour < item.endHour;
        }
        return kstHour >= item.startHour || kstHour < item.endHour;
      }) ?? channel.schedule[0])
    : { title: channel.title, desc: channel.description };

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PICKLE LIVE - ${channel.title}</title>
    <link>https://your-site.com/rss/${id}</link>
    <description>${channel.description || "실시간 스트리밍 피드"}</description>
    <item>
      <title>[LIVE] ${currentProgram.title}</title>
      <description>${currentProgram.desc || channel.description}</description>
      <enclosure url="${channel.stream_url}" length="0" type="application/x-mpegURL" />
      <pubDate>${now.toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

  res.setHeader("Content-Type", xmlHeaders["Content-Type"]);
  res.setHeader(
    "Access-Control-Allow-Origin",
    xmlHeaders["Access-Control-Allow-Origin"],
  );
  res.setHeader("Cache-Control", xmlHeaders["Cache-Control"]);
  res.setHeader("Pragma", xmlHeaders.Pragma);
  res.setHeader("Expires", xmlHeaders.Expires);
  res.status(200).send(rssXml);
}
