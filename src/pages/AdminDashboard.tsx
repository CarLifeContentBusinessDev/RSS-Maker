import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Eye,
  Pencil,
  Save,
  Radio,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import "./AdminDashboard.css";

// 1. 채널 데이터 타입 정의
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
}

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL as string | undefined
)?.trim();
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
)?.trim();

// 환경변수가 없으면 null로 두고 화면에서 안내합니다.
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default function AdminDashboard() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [initialChannels, setInitialChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newChannel, setNewChannel] = useState<Channel>({
    id: "",
    title: "",
    stream_url: "",
    description: "",
    schedule: [],
  });

  const [draggingScheduleIndex, setDraggingScheduleIndex] = useState<
    number | null
  >(null);
  const [draggingNewScheduleIndex, setDraggingNewScheduleIndex] = useState<
    number | null
  >(null);

  const clampMinute = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(59, Math.max(0, value));
  };

  const formatTwoDigits = (value: number): string =>
    String(Math.max(0, Math.floor(Number(value) || 0))).padStart(2, "0");

  const parseBoundedNumber = (
    raw: string,
    min: number,
    max: number,
    fallback = 0,
  ): number => {
    const onlyDigits = raw.replace(/\D/g, "");
    if (!onlyDigits) return fallback;
    const parsed = Number(onlyDigits);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  const getStartMinutes = (item: ScheduleItem): number => {
    const hour = Number(item.startHour ?? 0);
    const minute = clampMinute(Number(item.startMinute ?? 0));
    return Math.max(0, hour * 60 + minute);
  };

  const getEndMinutes = (item: ScheduleItem): number => {
    const hour = Number(item.endHour ?? 0);
    const minute = clampMinute(Number(item.endMinute ?? 0));
    if (hour >= 24) {
      return 1440;
    }
    return Math.max(0, hour * 60 + minute);
  };

  const formatHm = (hour: number, minute?: number): string => {
    const h = String(hour).padStart(2, "0");
    const m = String(clampMinute(Number(minute ?? 0))).padStart(2, "0");
    return `${h}:${m}`;
  };

  const formatScheduleRange = (item: ScheduleItem): string => {
    return `${formatHm(item.startHour, item.startMinute)} - ${formatHm(item.endHour, item.endMinute)}`;
  };

  const moveArrayItem = <T,>(arr: T[], from: number, to: number): T[] => {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= arr.length ||
      to >= arr.length
    ) {
      return arr;
    }

    const copy = [...arr];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    return copy;
  };

  // 2. 데이터 불러오기 함수
  const fetchChannels = useCallback(async () => {
    setErrorMessage("");

    if (!supabase) {
      setErrorMessage(
        "Supabase 설정이 없습니다. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해 주세요.",
      );
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("streaming")
        .select("*")
        .order("id");

      if (error) throw error;
      if (data) {
        const typedData = data as Channel[];
        setChannels(typedData);
        setInitialChannels(typedData);
      }
    } catch (err) {
      console.error("데이터 로드 실패:", err);
      setErrorMessage(
        "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChannels();
  }, [fetchChannels]);

  // 3. 실시간 입력 변경 처리 (originalId로 찾아야 id 변경 시 꼬이지 않음)
  const handleInputChange = (
    originalId: string,
    field: keyof Channel,
    value: string,
  ) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === originalId ? { ...ch, [field]: value } : ch)),
    );
  };

  // 4. DB 업데이트 (Save)
  const saveChanges = async (
    channel: Channel,
    originalId?: string,
  ): Promise<boolean> => {
    setErrorMessage("");

    if (!supabase) {
      setErrorMessage(
        "Supabase 설정이 없습니다. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해 주세요.",
      );
      return false;
    }

    const targetId = originalId ?? channel.id;
    setIsSaving(targetId);
    try {
      const { error } = await supabase
        .from("streaming")
        .update({
          id: channel.id,
          title: channel.title,
          stream_url: channel.stream_url,
          description: channel.description,
          schedule: channel.schedule,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);

      if (error) throw error;
      setInitialChannels((prev) =>
        prev.map((item) => (item.id === targetId ? channel : item)),
      );
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setErrorMessage("저장 중 오류가 발생했습니다: " + message);
      return false;
    } finally {
      setIsSaving(null);
    }
  };

  // 5. 새 채널 생성
  const createChannel = async (): Promise<boolean> => {
    setErrorMessage("");

    if (!supabase) {
      setErrorMessage(
        "Supabase 설정이 없습니다. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해 주세요.",
      );
      return false;
    }

    if (!newChannel.id.trim()) {
      setErrorMessage("채널 ID는 필수입니다.");
      return false;
    }

    setIsSaving("__new__");
    try {
      const { error } = await supabase.from("streaming").insert({
        id: newChannel.id.trim(),
        title: newChannel.title,
        stream_url: newChannel.stream_url,
        description: newChannel.description,
        schedule: newChannel.schedule,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      await fetchChannels();
      setIsCreating(false);
      setNewChannel({
        id: "",
        title: "",
        stream_url: "",
        description: "",
        schedule: [],
      });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setErrorMessage("생성 중 오류가 발생했습니다: " + message);
      return false;
    } finally {
      setIsSaving(null);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm(`채널 "${id}"을(를) 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from("streaming").delete().eq("id", id);
      if (error) throw error;
      setChannels((prev) => prev.filter((ch) => ch.id !== id));
      setInitialChannels((prev) => prev.filter((ch) => ch.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setErrorMessage("삭제 중 오류가 발생했습니다: " + message);
    }
  };

  const filteredChannels = channels.filter((ch) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return [ch.id, ch.title, ch.description, ch.stream_url]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });

  const hasChanges = (channel: Channel) => {
    const original = initialChannels.find(
      (item) => item.id === (selectedChannelId ?? channel.id),
    );
    if (!original) return true;

    return (
      original.id !== channel.id ||
      original.title !== channel.title ||
      original.stream_url !== channel.stream_url ||
      original.description !== channel.description ||
      JSON.stringify(original.schedule ?? []) !==
        JSON.stringify(channel.schedule ?? [])
    );
  };

  const getCurrentProgram = (channel: Channel): ScheduleItem | null => {
    if (!Array.isArray(channel.schedule) || channel.schedule.length === 0) {
      return null;
    }
    const now = new Date();
    const kstHour = (now.getUTCHours() + 9) % 24;
    const kstMinute = now.getUTCMinutes();
    const kstTotalMinutes = kstHour * 60 + kstMinute;
    return (
      channel.schedule.find((item) => {
        const start = getStartMinutes(item);
        const end = getEndMinutes(item);
        if (start < end) {
          return kstTotalMinutes >= start && kstTotalMinutes < end;
        }
        return kstTotalMinutes >= start || kstTotalMinutes < end;
      }) ?? channel.schedule[0]
    );
  };

  const selectedChannel = selectedChannelId
    ? (channels.find((item) => item.id === selectedChannelId) ?? null)
    : null;

  const resetChannel = (channelId: string) => {
    const original = initialChannels.find((item) => item.id === channelId);
    if (!original) return;
    setChannels((prev) =>
      prev.map((item) => (item.id === channelId ? { ...original } : item)),
    );
  };

  const openDetail = (channelId: string) => {
    setSelectedChannelId(channelId);
    setIsEditMode(false);
  };

  const closeDetail = () => {
    setSelectedChannelId(null);
    setIsEditMode(false);
    setErrorMessage("");
  };

  const handleSaveInDetail = async () => {
    if (!selectedChannel) return;
    const ok = await saveChanges(
      selectedChannel,
      selectedChannelId ?? undefined,
    );
    if (ok) {
      setSelectedChannelId(selectedChannel.id);
      setIsEditMode(false);
    }
  };

  // 편성표 편집 헬퍼
  const updateScheduleItem = (
    channelId: string,
    idx: number,
    field: keyof ScheduleItem,
    value: string | number,
  ) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch;
        const newSchedule = ch.schedule.map((item, i) =>
          i === idx ? { ...item, [field]: value } : item,
        );
        return { ...ch, schedule: newSchedule };
      }),
    );
  };

  const addScheduleItem = (channelId: string) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch;
        return {
          ...ch,
          schedule: [
            ...ch.schedule,
            {
              startHour: 0,
              startMinute: 0,
              endHour: 1,
              endMinute: 0,
              title: "",
              desc: "",
            },
          ],
        };
      }),
    );
  };

  const moveScheduleItem = (channelId: string, from: number, to: number) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch;
        return { ...ch, schedule: moveArrayItem(ch.schedule, from, to) };
      }),
    );
  };

  const removeScheduleItem = (channelId: string, idx: number) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch;
        return { ...ch, schedule: ch.schedule.filter((_, i) => i !== idx) };
      }),
    );
  };

  const updateNewScheduleItem = (
    idx: number,
    field: keyof ScheduleItem,
    value: string | number,
  ) => {
    setNewChannel((prev) => ({
      ...prev,
      schedule: prev.schedule.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const addNewScheduleItem = () => {
    setNewChannel((prev) => ({
      ...prev,
      schedule: [
        ...prev.schedule,
        {
          startHour: 0,
          startMinute: 0,
          endHour: 1,
          endMinute: 0,
          title: "",
          desc: "",
        },
      ],
    }));
  };

  const moveNewScheduleItem = (from: number, to: number) => {
    setNewChannel((prev) => ({
      ...prev,
      schedule: moveArrayItem(prev.schedule, from, to),
    }));
  };

  const removeNewScheduleItem = (idx: number) => {
    setNewChannel((prev) => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== idx),
    }));
  };

  if (loading) {
    return (
      <div className="state-loading">
        <div>
          <RefreshCw className="animate-spin" />
          <p>데이터베이스 연결 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div className="admin-brand">
            <span className="admin-badge">Streaming Control Board</span>
            <h1 className="admin-title">
              <Radio size={34} /> Streaming RSS Maker
            </h1>
            <p className="admin-subtitle">
              채널 메타데이터를 수정하고 RSS 피드 결과를 즉시 확인할 수
              있습니다.
            </p>
          </div>
          <div className="admin-actions">
            <button
              onClick={() => void fetchChannels()}
              className="admin-refresh"
              title="새로고침"
              type="button"
            >
              <RefreshCw size={19} />
            </button>
            <div className="admin-pill">
              <span className="admin-pill-dot"></span>
              Live Cloud Sync
            </div>
          </div>
        </header>

        {errorMessage ? <p className="admin-error">{errorMessage}</p> : null}

        {isCreating ? (
          /* ── 새 채널 생성 폼 ── */
          <main className="detail-wrap">
            <div className="detail-toolbar">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setIsCreating(false);
                  setErrorMessage("");
                  setNewChannel({
                    id: "",
                    title: "",
                    stream_url: "",
                    description: "",
                    schedule: [],
                  });
                }}
              >
                <ArrowLeft size={16} /> 목록으로
              </button>
              <div className="detail-actions">
                <button
                  type="button"
                  className="channel-save"
                  onClick={() => void createChannel()}
                  disabled={isSaving === "__new__" || !newChannel.id.trim()}
                >
                  {isSaving === "__new__" ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {isSaving === "__new__" ? "생성 중..." : "채널 생성"}
                </button>
              </div>
            </div>

            <article className="detail-card">
              <div className="channel-head">
                <span className="channel-id">새 채널 등록</span>
              </div>
              <div className="detail-grid">
                <div className="detail-main">
                  <div className="form-group">
                    <label>
                      채널 ID <span className="form-required">*</span>
                    </label>
                    <input
                      type="text"
                      value={newChannel.id}
                      onChange={(e) =>
                        setNewChannel((prev) => ({
                          ...prev,
                          id: e.target.value,
                        }))
                      }
                      placeholder="예: ytn, kbs1 (영문/숫자/하이픈)"
                    />
                  </div>
                  <div className="form-group">
                    <label>채널 타이틀</label>
                    <input
                      type="text"
                      value={newChannel.title}
                      onChange={(e) =>
                        setNewChannel((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="앱에 표시할 채널 이름"
                    />
                  </div>
                  <div className="form-group">
                    <label>스트리밍 소스 URL (enclosure URL)</label>
                    <input
                      type="text"
                      value={newChannel.stream_url}
                      onChange={(e) =>
                        setNewChannel((prev) => ({
                          ...prev,
                          stream_url: e.target.value,
                        }))
                      }
                      placeholder="https://.../playlist.m3u8"
                      className="url-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>채널 상세 설명</label>
                    <textarea
                      value={newChannel.description}
                      onChange={(e) =>
                        setNewChannel((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="청취자에게 보여줄 방송 설명"
                    />
                  </div>
                </div>

                <aside className="detail-side">
                  <div className="side-title-row">
                    <h3 className="side-title">편성표</h3>
                    <button
                      type="button"
                      className="ghost-btn schedule-add-btn"
                      onClick={addNewScheduleItem}
                    >
                      <Plus size={14} /> 항목 추가
                    </button>
                  </div>
                  {newChannel.schedule.length === 0 ? (
                    <p className="schedule-empty">
                      추가 버튼으로 편성표를 등록하세요.
                    </p>
                  ) : (
                    <ul className="schedule-list schedule-edit-list">
                      {newChannel.schedule.map((item, idx) => (
                        <li
                          key={`new-schedule-${idx}`}
                          className="schedule-edit-item"
                          draggable
                          onDragStart={() => setDraggingNewScheduleIndex(idx)}
                          onDragEnd={() => setDraggingNewScheduleIndex(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggingNewScheduleIndex === null) return;
                            moveNewScheduleItem(draggingNewScheduleIndex, idx);
                            setDraggingNewScheduleIndex(null);
                          }}
                        >
                          <div className="schedule-edit-head">
                            <p className="schedule-edit-index">
                              ⠿ #{idx + 1} 편성
                            </p>
                            <button
                              type="button"
                              className="schedule-delete-btn"
                              onClick={() => removeNewScheduleItem(idx)}
                            >
                              <Trash2 size={13} /> 삭제
                            </button>
                          </div>
                          <div className="schedule-edit-time">
                            <label>
                              시작
                              <div className="schedule-hm">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={formatTwoDigits(item.startHour)}
                                  onChange={(e) =>
                                    updateNewScheduleItem(
                                      idx,
                                      "startHour",
                                      parseBoundedNumber(e.target.value, 0, 23),
                                    )
                                  }
                                  className="schedule-hour-input"
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={formatTwoDigits(item.startMinute ?? 0)}
                                  onChange={(e) =>
                                    updateNewScheduleItem(
                                      idx,
                                      "startMinute",
                                      parseBoundedNumber(e.target.value, 0, 59),
                                    )
                                  }
                                  className="schedule-hour-input"
                                />
                              </div>
                            </label>
                            <span>—</span>
                            <label>
                              종료
                              <div className="schedule-hm">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={formatTwoDigits(item.endHour)}
                                  onChange={(e) =>
                                    updateNewScheduleItem(
                                      idx,
                                      "endHour",
                                      parseBoundedNumber(e.target.value, 0, 23),
                                    )
                                  }
                                  className="schedule-hour-input"
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={formatTwoDigits(item.endMinute ?? 0)}
                                  onChange={(e) =>
                                    updateNewScheduleItem(
                                      idx,
                                      "endMinute",
                                      parseBoundedNumber(e.target.value, 0, 59),
                                    )
                                  }
                                  className="schedule-hour-input"
                                />
                              </div>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) =>
                              updateNewScheduleItem(
                                idx,
                                "title",
                                e.target.value,
                              )
                            }
                            placeholder="프로그램 제목"
                            className="schedule-text-input"
                          />
                          <input
                            type="text"
                            value={item.desc}
                            onChange={(e) =>
                              updateNewScheduleItem(idx, "desc", e.target.value)
                            }
                            placeholder="프로그램 설명"
                            className="schedule-text-input"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </div>
            </article>
          </main>
        ) : selectedChannel ? (
          /* ── 상세 / 편집 뷰 ── */
          <main className="detail-wrap">
            <div className="detail-toolbar">
              <button type="button" className="ghost-btn" onClick={closeDetail}>
                <ArrowLeft size={16} /> 목록으로
              </button>
              <div className="detail-actions">
                <a
                  href={`/rss/${selectedChannelId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ghost-btn"
                >
                  RSS Preview <ExternalLink size={14} />
                </a>

                {!isEditMode ? (
                  <button
                    type="button"
                    className="channel-save"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Pencil size={16} /> 편집 시작
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => {
                        resetChannel(selectedChannelId!);
                        setIsEditMode(false);
                      }}
                    >
                      변경 취소
                    </button>
                    <button
                      type="button"
                      className="channel-save"
                      onClick={() => void handleSaveInDetail()}
                      disabled={
                        isSaving !== null || !hasChanges(selectedChannel)
                      }
                    >
                      {isSaving !== null ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      {isSaving !== null ? "저장 중..." : "저장"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <article className="detail-card">
              <div className="channel-head">
                <span className="channel-id">ID: {selectedChannelId}</span>
                <span className="admin-count">
                  상태 {hasChanges(selectedChannel) ? "수정됨" : "최신"}
                </span>
              </div>

              <div className="detail-grid">
                <div className="detail-main">
                  <div className="form-group">
                    <label>채널 ID</label>
                    <input
                      type="text"
                      value={selectedChannel.id || ""}
                      onChange={(e) =>
                        handleInputChange(
                          selectedChannelId!,
                          "id",
                          e.target.value,
                        )
                      }
                      placeholder="채널 고유 ID"
                      disabled={!isEditMode}
                    />
                  </div>

                  <div className="form-group">
                    <label>채널 타이틀</label>
                    <input
                      type="text"
                      value={selectedChannel.title || ""}
                      onChange={(e) =>
                        handleInputChange(
                          selectedChannelId!,
                          "title",
                          e.target.value,
                        )
                      }
                      placeholder="앱에 표시할 채널 이름"
                      disabled={!isEditMode}
                    />
                  </div>

                  <div className="form-group">
                    <label>스트리밍 소스 URL (enclosure URL)</label>
                    <input
                      type="text"
                      value={selectedChannel.stream_url || ""}
                      onChange={(e) =>
                        handleInputChange(
                          selectedChannelId!,
                          "stream_url",
                          e.target.value,
                        )
                      }
                      placeholder="https://.../playlist.m3u8"
                      disabled={!isEditMode}
                      className="url-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>채널 상세 설명</label>
                    <textarea
                      value={selectedChannel.description || ""}
                      onChange={(e) =>
                        handleInputChange(
                          selectedChannelId!,
                          "description",
                          e.target.value,
                        )
                      }
                      placeholder="청취자에게 보여줄 방송 설명"
                      disabled={!isEditMode}
                    />
                  </div>
                </div>

                <aside className="detail-side">
                  <div className="side-title-row">
                    <h3 className="side-title">편성표</h3>
                    {isEditMode && (
                      <button
                        type="button"
                        className="ghost-btn schedule-add-btn"
                        onClick={() => addScheduleItem(selectedChannelId!)}
                      >
                        <Plus size={14} /> 항목 추가
                      </button>
                    )}
                  </div>
                  {selectedChannel.schedule?.length ? (
                    isEditMode ? (
                      <ul className="schedule-list schedule-edit-list">
                        {selectedChannel.schedule.map((item, idx) => (
                          <li
                            key={`${selectedChannelId}-sch-edit-${idx}`}
                            className="schedule-edit-item"
                            draggable
                            onDragStart={() => setDraggingScheduleIndex(idx)}
                            onDragEnd={() => setDraggingScheduleIndex(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggingScheduleIndex === null) return;
                              moveScheduleItem(
                                selectedChannelId!,
                                draggingScheduleIndex,
                                idx,
                              );
                              setDraggingScheduleIndex(null);
                            }}
                          >
                            <div className="schedule-edit-head">
                              <p className="schedule-edit-index">
                                ⠿ #{idx + 1}
                              </p>
                              <button
                                type="button"
                                className="schedule-delete-btn"
                                onClick={() =>
                                  removeScheduleItem(selectedChannelId!, idx)
                                }
                              >
                                <Trash2 size={13} /> 삭제
                              </button>
                            </div>
                            <div className="schedule-edit-time">
                              <label>
                                시작
                                <div className="schedule-hm">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={2}
                                    value={formatTwoDigits(item.startHour)}
                                    onChange={(e) =>
                                      updateScheduleItem(
                                        selectedChannelId!,
                                        idx,
                                        "startHour",
                                        parseBoundedNumber(
                                          e.target.value,
                                          0,
                                          23,
                                        ),
                                      )
                                    }
                                    className="schedule-hour-input"
                                  />
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={2}
                                    value={formatTwoDigits(
                                      item.startMinute ?? 0,
                                    )}
                                    onChange={(e) =>
                                      updateScheduleItem(
                                        selectedChannelId!,
                                        idx,
                                        "startMinute",
                                        parseBoundedNumber(
                                          e.target.value,
                                          0,
                                          59,
                                        ),
                                      )
                                    }
                                    className="schedule-hour-input"
                                  />
                                </div>
                              </label>
                              <span>—</span>
                              <label>
                                종료
                                <div className="schedule-hm">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={2}
                                    value={formatTwoDigits(item.endHour)}
                                    onChange={(e) =>
                                      updateScheduleItem(
                                        selectedChannelId!,
                                        idx,
                                        "endHour",
                                        parseBoundedNumber(
                                          e.target.value,
                                          0,
                                          23,
                                        ),
                                      )
                                    }
                                    className="schedule-hour-input"
                                  />
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={2}
                                    value={formatTwoDigits(item.endMinute ?? 0)}
                                    onChange={(e) =>
                                      updateScheduleItem(
                                        selectedChannelId!,
                                        idx,
                                        "endMinute",
                                        parseBoundedNumber(
                                          e.target.value,
                                          0,
                                          59,
                                        ),
                                      )
                                    }
                                    className="schedule-hour-input"
                                  />
                                </div>
                              </label>
                            </div>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) =>
                                updateScheduleItem(
                                  selectedChannelId!,
                                  idx,
                                  "title",
                                  e.target.value,
                                )
                              }
                              placeholder="프로그램 제목"
                              className="schedule-text-input"
                            />
                            <input
                              type="text"
                              value={item.desc}
                              onChange={(e) =>
                                updateScheduleItem(
                                  selectedChannelId!,
                                  idx,
                                  "desc",
                                  e.target.value,
                                )
                              }
                              placeholder="프로그램 설명"
                              className="schedule-text-input"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="schedule-list">
                        {selectedChannel.schedule.map((item, idx) => (
                          <li key={`${selectedChannelId}-schedule-${idx}`}>
                            <p className="schedule-time">
                              {formatScheduleRange(item)}
                            </p>
                            <p className="schedule-title">{item.title}</p>
                            <p className="schedule-desc">{item.desc}</p>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : (
                    <p className="schedule-empty">
                      {isEditMode
                        ? "추가 버튼으로 편성표를 등록하세요."
                        : "등록된 편성표가 없습니다."}
                    </p>
                  )}
                </aside>
              </div>
            </article>
          </main>
        ) : (
          /* ── 목록 뷰 ── */
          <>
            <div className="admin-toolbar">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="채널 ID, 제목, URL로 검색"
              />
              <div className="toolbar-right">
                <div className="admin-count">
                  {filteredChannels.length}개 채널 표시 / 총 {channels.length}개
                </div>
                <button
                  type="button"
                  className="channel-save"
                  onClick={() => {
                    setIsCreating(true);
                    setErrorMessage("");
                  }}
                >
                  <Plus size={16} /> 새 채널 추가
                </button>
              </div>
            </div>

            {filteredChannels.length === 0 ? (
              <div className="state-empty">
                <p>검색 결과가 없습니다. 다른 키워드로 다시 시도해 주세요.</p>
              </div>
            ) : (
              <main className="admin-grid">
                {filteredChannels.map((ch) => (
                  <article key={ch.id} className="channel-card list-card">
                    {(() => {
                      const currentProgram = getCurrentProgram(ch);
                      return (
                        <>
                          <div className="channel-head">
                            <span className="channel-id">ID: {ch.id}</span>
                            <span className="admin-count">
                              편성표 {ch.schedule?.length ?? 0}개
                            </span>
                          </div>

                          <div className="channel-body">
                            <h3 className="list-title">
                              {ch.title || "제목 없음"}
                            </h3>
                            <p className="list-desc">
                              {ch.description || "설명이 없습니다."}
                            </p>

                            <div className="list-program">
                              <p className="list-program-label">현재 편성</p>
                              {currentProgram ? (
                                <>
                                  <p className="list-program-time">
                                    {formatScheduleRange(currentProgram)}
                                  </p>
                                  <p className="list-program-title">
                                    {currentProgram.title ||
                                      "프로그램 제목 없음"}
                                  </p>
                                  <p className="list-program-desc">
                                    {currentProgram.desc ||
                                      "프로그램 설명 없음"}
                                  </p>
                                </>
                              ) : (
                                <p className="list-program-empty">
                                  등록된 편성표가 없습니다.
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="channel-meta">
                            <div className="list-actions">
                              <a
                                href={`/rss/${ch.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="channel-link list-xml-link"
                              >
                                RSS 보러가기 <ExternalLink size={14} />
                              </a>
                              <button
                                type="button"
                                className="channel-save"
                                onClick={() => openDetail(ch.id)}
                              >
                                <Eye size={16} /> 상세 보기
                              </button>
                              <button
                                type="button"
                                className="channel-delete-btn"
                                onClick={() => handleDeleteChannel(ch.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </article>
                ))}
              </main>
            )}
          </>
        )}

        <footer className="admin-footer">
          &copy; 2026 PICKLE Audio Project. Streaming RSS Manager.
        </footer>
      </div>
    </div>
  );
}
