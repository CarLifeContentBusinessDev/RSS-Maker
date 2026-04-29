import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Save, RefreshCw, Plus, Trash2 } from "lucide-react";
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

export default function ChannelCreate() {
  const navigate = useNavigate();

  const [newChannel, setNewChannel] = useState<Channel>({
    id: "",
    title: "",
    stream_url: "",
    image_url: "",
    description: "",
    schedule: [],
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [draggingScheduleIndex, setDraggingScheduleIndex] = useState<
    number | null
  >(null);

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

    setIsSaving(true);
    try {
      const { error } = await supabase.from("streaming").insert({
        id: newChannel.id.trim(),
        title: newChannel.title,
        stream_url: newChannel.stream_url,
        image_url: newChannel.image_url?.trim() || null,
        description: newChannel.description,
        schedule: newChannel.schedule,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setErrorMessage("생성 중 오류가 발생했습니다: " + message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    const ok = await createChannel();
    if (ok) {
      navigate("/admin");
    }
  };

  const updateScheduleItem = (
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

  const addScheduleItem = () => {
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

  const moveScheduleItem = (from: number, to: number) => {
    setNewChannel((prev) => ({
      ...prev,
      schedule: moveArrayItem(prev.schedule, from, to),
    }));
  };

  const removeScheduleItem = (idx: number) => {
    setNewChannel((prev) => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== idx),
    }));
  };

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
              <button
                type="button"
                className="channel-save"
                onClick={() => void handleCreate()}
                disabled={isSaving || !newChannel.id.trim()}
              >
                {isSaving ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {isSaving ? "생성 중..." : "채널 생성"}
              </button>
            </div>
          </div>

          {errorMessage ? <p className="admin-error">{errorMessage}</p> : null}

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
                  <label>채널 썸네일 URL</label>
                  <input
                    type="text"
                    value={newChannel.image_url ?? ""}
                    onChange={(e) =>
                      setNewChannel((prev) => ({
                        ...prev,
                        image_url: e.target.value,
                      }))
                    }
                    placeholder="https://.../thumbnail.jpg"
                    className="url-input"
                  />
                  <ImageUrlPreview
                    url={newChannel.image_url}
                    alt={`${newChannel.title || newChannel.id || "new-channel"} thumbnail`}
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
                    onClick={addScheduleItem}
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
                          <p className="schedule-edit-index">
                            ⠿ #{idx + 1} 편성
                          </p>
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
