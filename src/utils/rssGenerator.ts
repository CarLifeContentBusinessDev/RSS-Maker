import type { Channel } from "../types/channel.ts";
import type { ScheduleItem } from "../types/scheduleItem.ts";

export const generateRssXml = (
  channel: Channel,
  id: string,
  currentProgram: ScheduleItem | { title: string; desc: string } | null,
  now: Date,
) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" 
     xmlns:content="http://purl.org/rss/1.0/modules/content/" 
     version="2.0">
  <channel>
    <title><![CDATA[PICKLE LIVE - ${channel.title}]]></title>
    <description><![CDATA[${channel.description || "실시간 스트리밍"}]]></description>
    <link>https://your-site.com</link> 
    <language>ko-KR</language> 
    <itunes:author><![CDATA[${channel.author || "PICKLE"}]]></itunes:author>
    <itunes:explicit>no</itunes:explicit> 
    <itunes:type>episodic</itunes:type>
    <itunes:category text="${channel.category || "News"}" /> 
    <itunes:image href="${channel.image_url}" /> 
    <item>
      <title><![CDATA[[LIVE] ${currentProgram?.title || channel.title}]]></title>
      <description><![CDATA[${currentProgram?.desc || channel.description}]]></description>
      <link>https://your-site.com/rss/${id}</link> 
      <pubDate>${now.toUTCString()}</pubDate>
      <guid isPermaLink="false">${id}-${now.getTime()}</guid>
      <enclosure url="${channel.stream_url}" length="1" type="application/x-mpegURL" />
      <itunes:duration>00:00:00</itunes:duration>
      <itunes:explicit>no</itunes:explicit>
    </item>
  </channel>
</rss>`.trim();
};
