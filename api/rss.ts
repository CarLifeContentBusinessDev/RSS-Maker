import { createClient } from "@supabase/supabase-js";

type QueryValue = string | string[] | undefined;

interface ScheduleItem {
  startHour: number;
  startMinute?: number;
  endHour: number;
  endMinute?: number;
  title: string;
  desc: string;
}

interface Channel {
  id: string;
  title: string;
  stream_url: string;
  description: string;
  schedule: ScheduleItem[];
  image_url: string;
  author: string;
  category: string;
  created_at: string;
  updated_at: string;
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
    res.status(500).send("Supabase 환경변수가 없습니다.");
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
  const kstMinute = now.getUTCMinutes();
  const nowMinutes = kstHour * 60 + kstMinute;

  const startMinutes = (item: ScheduleItem): number => {
    const minute = Math.max(0, Math.min(59, Number(item.startMinute ?? 0)));
    return Math.max(0, Number(item.startHour ?? 0) * 60 + minute);
  };

  const endMinutes = (item: ScheduleItem): number => {
    const minute = Math.max(0, Math.min(59, Number(item.endMinute ?? 0)));
    const hour = Number(item.endHour ?? 0);
    if (hour >= 24) return 1440;
    return Math.max(0, hour * 60 + minute);
  };

  const currentProgram = Array.isArray(channel.schedule)
    ? (channel.schedule.find((item) => {
        const start = startMinutes(item);
        const end = endMinutes(item);
        if (start < end) {
          return nowMinutes >= start && nowMinutes < end;
        }
        return nowMinutes >= start || nowMinutes < end;
      }) ?? channel.schedule[0])
    : { title: channel.title, desc: channel.description };

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" 
     xmlns:content="http://purl.org/rss/1.0/modules/content/" 
     version="2.0">
  <channel>
    <title><![CDATA[PICKLE LIVE - ${channel.title}]]></title>
    <description><![CDATA[${channel.description || "실시간 스트리밍 피드"}]]></description>
    <link>https://your-site.com</link> <language>ko-KR</language> <itunes:author>${channel.author}</itunes:author>
    <itunes:explicit>no</itunes:explicit> <itunes:type>episodic</itunes:type>
    
    <itunes:category text="${channel.category}" /> 
    
    <itunes:image href="${channel.image_url}" /> 

    <item>
      <title><![CDATA[[LIVE] ${currentProgram?.title || channel.title}]]></title>
      <description><![CDATA[${currentProgram?.desc || channel.description}]]></description>
      <link>https://your-site.com/rss/${id}</link> <pubDate>${now.toUTCString()}</pubDate>
      <guid isPermaLink="false">${id}-${now.getTime()}</guid>
      
      <enclosure url="${channel.stream_url}" length="1024" type="audio/mpeg" />
      
      <itunes:duration>00:00:00</itunes:duration>
      <itunes:explicit>no</itunes:explicit>
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
