import type { Channel } from "../types/channel";

export const CHANNEL_DATA: Record<string, Channel> = {
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
