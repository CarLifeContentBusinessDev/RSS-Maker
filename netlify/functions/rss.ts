import { Handler, HandlerEvent } from "@netlify/functions";

interface ScheduleItem {
  startHour: number;
  endHour: number;
  title: string;
  desc: string;
}

interface Channel {
  streamUrl: string;
  schedule: ScheduleItem[];
}

const CHANNEL_DATA: Record<string, Channel> = {
  ytn: {
    streamUrl:
      "https://radiolive.ytn.co.kr/radio/_definst_/20211118_fmlive/playlist.m3u8",
    schedule: [
      {
        startHour: 0,
        endHour: 6,
        title: "ytn 1",
        desc: "ytn 1 description",
      },
      {
        startHour: 6,
        endHour: 12,
        title: "ytn 2",
        desc: "ytn 2 description",
      },
      {
        startHour: 12,
        endHour: 18,
        title: "ytn 3",
        desc: "ytn 3 description",
      },
      {
        startHour: 18,
        endHour: 24,
        title: "ytn 4",
        desc: "ytn 4 description",
      },
    ],
  },
  test: {
    streamUrl: "https://example.com/test.m3u8",
    schedule: [
      {
        startHour: 9,
        endHour: 18,
        title: "K-Pop 히트곡",
        desc: "낮 시간 신나는 아이돌 음악",
      },
      {
        startHour: 18,
        endHour: 9,
        title: "K-Ballad 밤",
        desc: "밤에 듣기 좋은 발라드",
      },
    ],
  },
};

export const handler: Handler = async (event: HandlerEvent) => {
  const pathParts = event.path.split("/");
  const id = pathParts[pathParts.length - 1];

  // 1. 해당 ID의 채널 데이터 가져오기
  const selectedChannel = CHANNEL_DATA[id] || CHANNEL_DATA["ytn"];

  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;

  // 2. 선택된 채널의 스케줄 안에서 현재 시간 프로그램 찾기
  const currentProgram =
    selectedChannel.schedule.find((p: ScheduleItem) => {
      if (p.startHour < p.endHour) {
        return kstHour >= p.startHour && kstHour < p.endHour;
      } else {
        // 날짜를 넘어가는 경우 처리
        return kstHour >= p.startHour || kstHour < p.endHour;
      }
    }) || selectedChannel.schedule[0];

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PICKLE LIVE - ${selectedChannel.streamUrl.includes("ytn") ? "YTN" : "K-Pop"}</title>
    <item>
      <title>[LIVE] ${currentProgram.title}</title>
      <description>${currentProgram.desc}</description>
      <enclosure url="${selectedChannel.streamUrl}" length="0" type="application/x-mpegURL" />
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
