import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { Eye, RefreshCw, Plus, Trash2, Copy, Check } from "lucide-react";
import { Radio } from "lucide-react";
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

export default function ChannelList() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const clampMinute = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(59, Math.max(0, value));
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) {
        const typedData = data as Channel[];
        setChannels(typedData);
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

  const handleDeleteChannel = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm(`채널 "${id}"을(를) 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from("streaming").delete().eq("id", id);
      if (error) throw error;
      setChannels((prev) => prev.filter((ch) => ch.id !== id));
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
              onClick={() => navigate("/admin/create")}
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
            {filteredChannels.map((ch) => {
              const currentProgram = getCurrentProgram(ch);
              return (
                <article key={ch.id} className="channel-card list-card">
                  <div className="channel-head">
                    <span className="channel-id">ID: {ch.id}</span>
                    <span className="admin-count">
                      편성표 {ch.schedule?.length ?? 0}개
                    </span>
                  </div>

                  <div className="channel-body">
                    <h3 className="list-title">{ch.title || "제목 없음"}</h3>
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
                            {currentProgram.title || "프로그램 제목 없음"}
                          </p>
                          <p className="list-program-desc">
                            {currentProgram.desc || "프로그램 설명 없음"}
                          </p>
                        </>
                      ) : (
                        <p className="list-program-empty">
                          등록된 편성표가 없습니다.
                        </p>
                      )}
                    </div>

                    <div className="list-program rss-url-box">
                      <p className="list-program-label">RSS 주소</p>
                      <a
                        href={`/rss/${ch.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="channel-link rss-url-link"
                      >
                        {`${window.location.origin}/rss/${ch.id}`}
                      </a>
                    </div>
                  </div>

                  <div className="channel-meta">
                    <div className="list-actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/rss/${ch.id}`,
                          );
                          setCopiedId(ch.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                      >
                        {copiedId === ch.id ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                        {copiedId === ch.id ? "복사됨" : "RSS 복사"}
                      </button>
                      <button
                        type="button"
                        className="channel-save"
                        onClick={() => navigate(`/admin/channel/${ch.id}`)}
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
                </article>
              );
            })}
          </main>
        )}

        <footer className="admin-footer">
          &copy; 2026 PICKLE Audio Project. Streaming RSS Manager.
        </footer>
      </div>
    </div>
  );
}
