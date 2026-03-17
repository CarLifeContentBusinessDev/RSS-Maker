import type { ScheduleItem } from "./scheduleItem";

export interface Channel {
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
