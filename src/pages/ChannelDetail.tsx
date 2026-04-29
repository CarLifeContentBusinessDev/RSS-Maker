import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Pencil,
  Save,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import "./AdminDashboard.css";

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
  image_url?: string;
  description: string;
  schedule: ScheduleItem[];
}

type ImagePreviewStatus =
  | "empty"
  | "invalid-url"
  | "loading"
  | "valid"
  | "invalid-image";

const isValidImageUrlFormat = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

function ImageUrlPreview({ url, alt }: { url?: string; alt: string }) {
  const normalizedUrl = (url ?? "").trim();
  const isFormatValid =
    normalizedUrl.length > 0 && isValidImageUrlFormat(normalizedUrl);
  const [checkedUrl, setCheckedUrl] = useState<string>("");
  const [isImageValid, setIsImageValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!normalizedUrl || !isFormatValid) return;

    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      setCheckedUrl(normalizedUrl);
      setIsImageValid(true);
    };
    image.onerror = () => {
      if (!active) return;
      setCheckedUrl(normalizedUrl);
      setIsImageValid(false);
    };
    image.src = normalizedUrl;

    return () => {
      active = false;
    };
  }, [normalizedUrl, isFormatValid]);

  let status: ImagePreviewStatus = "empty";
  if (!normalizedUrl) {
    status = "empty";
  } else if (!isFormatValid) {
    status = "invalid-url";
  } else if (checkedUrl !== normalizedUrl || isImageValid === null) {
    status = "loading";
  } else if (isImageValid) {
    status = "valid";
  } else {
    status = "invalid-image";
  }

  if (status === "empty") {
    return (
      <p className="img-url-hint">
        이미지 URL을 입력하면 미리보기가 표시됩니다.
      </p>
    );
  }

  if (status === "invalid-url") {
    return <p className="img-url-invalid">유효한 URL 형식이 아닙니다.</p>;
  }

  if (status === "invalid-image") {
    return <p className="img-url-invalid">유효한 이미지 URL이 아닙니다.</p>;
  }

  if (status === "loading") {
    return <p className="img-url-hint">이미지 확인 중...</p>;
  }

  return (
    <div className="img-url-preview-wrap">
      <img src={normalizedUrl} alt={alt} className="img-url-preview" />
      <p className="img-url-valid">유효한 이미지 URL입니다.</p>
    </div>
  );
}

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL as string | undefined
)?.trim();
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
)?.trim();

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default function ChannelDetail() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [initialChannel, setInitialChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [draggingScheduleIndex, setDraggingScheduleIndex] = useState<
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

  const fetchChannel = useCallback(async () => {
    setErrorMessage("");

    if (!supabase || !channelId) {
      setErrorMessage("유효하지 않은 채널입니다.");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("streaming")
        .select("*")
        .eq("id", channelId)
        .single();

      if (error) throw error;
      if (data) {
        const typedData = data as Channel;
        setChannel(typedData);
        setInitialChannel(typedData);
      }
    } catch (err) {
      console.error("채널 로드 실패:", err);
      setErrorMessage(
        "채널을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchChannel();
  }, [fetchChannel]);

  const handleInputChange = (field: keyof Channel, value: string) => {
    if (!channel) return;
    setChannel({ ...channel, [field]: value });
  };

  const saveChanges = async (): Promise<boolean> => {
    setErrorMessage("");

    if (!supabase || !channel || !channelId) {
      setErrorMessage("저장할 수 없습니다.");
      return false;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("streaming")
        .update({
          id: channel.id,
          title: channel.title,
          stream_url: channel.stream_url,
          image_url: channel.image_url ?? null,
          description: channel.description,
          schedule: channel.schedule,
          updated_at: new Date().toISOString(),
        })
        .eq("id", channelId);

      if (error) throw error;
      setInitialChannel(channel);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setErrorMessage("저장 중 오류가 발생했습니다: " + message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    const ok = await saveChanges();
    if (ok) {
      setIsEditMode(false);
    }
  };

  const resetChannel = () => {
    if (initialChannel) {
      setChannel({ ...initialChannel });
    }
  };

  const updateScheduleItem = (
    idx: number,
    field: keyof ScheduleItem,
    value: string | number,
  ) => {
    if (!channel) return;
    const newSchedule = channel.schedule.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item,
    );
    setChannel({ ...channel, schedule: newSchedule });
  };

  const addScheduleItem = () => {
    if (!channel) return;
    setChannel({
      ...channel,
      schedule: [
        ...channel.schedule,
        {
          startHour: 0,
          startMinute: 0,
          endHour: 1,
          endMinute: 0,
          title: "",
          desc: "",
        },
      ],
    });
  };

  const moveScheduleItem = (from: number, to: number) => {
    if (!channel) return;
    setChannel({
      ...channel,
      schedule: moveArrayItem(channel.schedule, from, to),
    });
  };

  const removeScheduleItem = (idx: number) => {
    if (!channel) return;
    setChannel({
      ...channel,
      schedule: channel.schedule.filter((_, i) => i !== idx),
    });
  };

  const handleDeleteChannel = async () => {
    if (!supabase) return;
    if (!window.confirm(`채널 "${channelId}"을(를) 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase
        .from("streaming")
        .delete()
        .eq("id", channelId);
      if (error) throw error;
      navigate("/admin");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setErrorMessage("삭제 중 오류가 발생했습니다: " + message);
    }
  };

  const hasChanges = (): boolean => {
    if (!channel || !initialChannel) return false;

    return (
      initialChannel.id !== channel.id ||
      initialChannel.title !== channel.title ||
      (initialChannel.image_url ?? "") !== (channel.image_url ?? "") ||
      initialChannel.stream_url !== channel.stream_url ||
      initialChannel.description !== channel.description ||
      JSON.stringify(initialChannel.schedule ?? []) !==
        JSON.stringify(channel.schedule ?? [])
    );
  };

  if (loading) {
    return (
      <div className="state-loading">
        <div>
          <RefreshCw className="animate-spin" />
          <p>채널 정보 로드 중...</p>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="state-empty">
        <p>채널을 찾을 수 없습니다.</p>
        <button
          type="button"
          className="channel-save"
          onClick={() => navigate("/admin")}
        >
          <ArrowLeft size={16} /> 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <main className="detail-wrap">
          <div className="detail-toolbar">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft size={16} /> 목록으로
            </button>
            <div className="detail-actions">
              <a
                href={`/rss/${channelId}`}
                target="_blank"
                rel="noreferrer"
                className="ghost-btn"
              >
                RSS Preview <ExternalLink size={14} />
              </a>

              {!isEditMode ? (
                <>
                  <button
                    type="button"
                    className="channel-save"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Pencil size={16} /> 편집 시작
                  </button>
                  <button
                    type="button"
                    className="channel-delete-btn"
                    onClick={() => void handleDeleteChannel()}
                  >
                    <Trash2 size={16} /> 삭제
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      resetChannel();
                      setIsEditMode(false);
                    }}
                  >
                    변경 취소
                  </button>
                  <button
                    type="button"
                    className="channel-save"
                    onClick={() => void handleSave()}
                    disabled={isSaving || !hasChanges()}
                  >
                    {isSaving ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {isSaving ? "저장 중..." : "저장"}
                  </button>
                </>
              )}
            </div>
          </div>

          {errorMessage ? <p className="admin-error">{errorMessage}</p> : null}

          <article className="detail-card">
            <div className="channel-head">
              <span className="channel-id">ID: {channelId}</span>
              <span className="admin-count">
                상태 {hasChanges() ? "수정됨" : "최신"}
              </span>
            </div>

            <div className="detail-grid">
              <div className="detail-main">
                <div className="form-group">
                  <label>채널 ID</label>
                  <input
                    type="text"
                    value={channel.id || ""}
                    onChange={(e) => handleInputChange("id", e.target.value)}
                    placeholder="채널 고유 ID"
                    disabled={!isEditMode}
                  />
                </div>

                <div className="form-group">
                  <label>채널 타이틀</label>
                  <input
                    type="text"
                    value={channel.title || ""}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="앱에 표시할 채널 이름"
                    disabled={!isEditMode}
                  />
                </div>

                <div className="form-group">
                  <label>스트리밍 소스 URL (enclosure URL)</label>
                  <input
                    type="text"
                    value={channel.stream_url || ""}
                    onChange={(e) =>
                      handleInputChange("stream_url", e.target.value)
                    }
                    placeholder="https://.../playlist.m3u8"
                    disabled={!isEditMode}
                    className="url-input"
                  />
                </div>

                <div className="form-group">
                  <label>채널 썸네일 URL</label>
                  <input
                    type="text"
                    value={channel.image_url || ""}
                    onChange={(e) =>
                      handleInputChange("image_url", e.target.value)
                    }
                    disabled={!isEditMode}
                    className="url-input"
                  />
                  <ImageUrlPreview
                    url={channel.image_url}
                    alt={`${channel.title || channel.id || "channel"} thumbnail`}
                  />
                </div>

                <div className="form-group">
                  <label>채널 상세 설명</label>
                  <textarea
                    value={channel.description || ""}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    placeholder="청취자에게 보여줄 방송 설명"
                    disabled={!isEditMode}
                  />
                </div>

                <div className="list-program rss-url-box">
                  <p className="list-program-label">RSS 주소</p>
                  <div className="rss-url-actions">
                    <a
                      href={`/rss/${channelId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="channel-link rss-url-link"
                    >
                      {`${window.location.origin}/rss/${channelId}`}
                    </a>
                    <button
                      type="button"
                      className="rss-detail-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/rss/${channelId}`,
                        );
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }}
                    >
                      {copiedId ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId ? "복사됨" : "URL 복사"}
                    </button>
                  </div>
                </div>
              </div>

              <aside className="detail-side">
                <div className="side-title-row">
                  <h3 className="side-title">편성표</h3>
                  {isEditMode && (
                    <button
                      type="button"
                      className="ghost-btn schedule-add-btn"
                      onClick={addScheduleItem}
                    >
                      <Plus size={14} /> 항목 추가
                    </button>
                  )}
                </div>
                {channel.schedule?.length ? (
                  isEditMode ? (
                    <ul className="schedule-list schedule-edit-list">
                      {channel.schedule.map((item, idx) => (
                        <li
                          key={`sch-edit-${idx}`}
                          className="schedule-edit-item"
                          draggable
                          onDragStart={() => setDraggingScheduleIndex(idx)}
                          onDragEnd={() => setDraggingScheduleIndex(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggingScheduleIndex === null) return;
                            moveScheduleItem(draggingScheduleIndex, idx);
                            setDraggingScheduleIndex(null);
                          }}
                        >
                          <div className="schedule-edit-head">
                            <p className="schedule-edit-index">⠿ #{idx + 1}</p>
                            <button
                              type="button"
                              className="schedule-delete-btn"
                              onClick={() => removeScheduleItem(idx)}
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
                                    updateScheduleItem(
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
                                    updateScheduleItem(
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
                                    updateScheduleItem(
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
                              updateScheduleItem(idx, "title", e.target.value)
                            }
                            placeholder="프로그램 제목"
                            className="schedule-text-input"
                          />
                          <input
                            type="text"
                            value={item.desc}
                            onChange={(e) =>
                              updateScheduleItem(idx, "desc", e.target.value)
                            }
                            placeholder="프로그램 설명"
                            className="schedule-text-input"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="schedule-list">
                      {channel.schedule.map((item, idx) => (
                        <li key={`schedule-${idx}`}>
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

        <footer className="admin-footer">
          &copy; 2026 PICKLE Audio Project. Streaming RSS Manager.
        </footer>
      </div>
    </div>
  );
}
