import type { ScheduleItem } from "./scheduleItem";

export interface Channel {
  streamUrl: string;
  schedule: ScheduleItem[];
}
