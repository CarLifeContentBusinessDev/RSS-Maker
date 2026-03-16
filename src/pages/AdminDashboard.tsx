import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Eye,
  Pencil,
  Save,
  Radio,
  Link as LinkIcon,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import "./AdminDashboard.css";

// 1. 채널 데이터 타입 정의
interface ScheduleItem {
  startHour: number;
  endHour: number;
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

  // 2. 데이터 불러오기 함수 (useCallback으로 최적화)
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
        .from("channels")
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
    // 린트 에러 방지를 위해 비동기 함수를 즉시 실행 함수로 감싸거나 void 사용
    void fetchChannels();
  }, [fetchChannels]);

  // 3. 실시간 입력 변경 처리
  const handleInputChange = (
    id: string,
    field: keyof Channel,
    value: string,
  ) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, [field]: value } : ch)),
    );
  };

  // 4. DB 업데이트 (Save)
  const saveChanges = async (channel: Channel): Promise<boolean> => {
    setErrorMessage("");

    if (!supabase) {
      setErrorMessage(
        "Supabase 설정이 없습니다. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해 주세요.",
      );
      return false;
    }

    setIsSaving(channel.id);
    try {
      const { error } = await supabase
        .from("channels")
        .update({
          title: channel.title,
          stream_url: channel.stream_url,
          description: channel.description,
          // 이 부분이 있어야 직접 넣은 schedule 데이터가 날아가지 않고 유지됩니다!
          schedule: channel.schedule,
        })
        .eq("id", channel.id);

      if (error) throw error;
      setInitialChannels((prev) =>
        prev.map((item) => (item.id === channel.id ? channel : item)),
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

  const filteredChannels = channels.filter((ch) => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) return true;

    return [ch.id, ch.title, ch.description, ch.stream_url]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });

  const hasChanges = (channel: Channel) => {
    const original = initialChannels.find((item) => item.id === channel.id);
    if (!original) return true;

    return (
      original.title !== channel.title ||
      original.stream_url !== channel.stream_url ||
      original.description !== channel.description ||
      JSON.stringify(original.schedule ?? []) !==
        JSON.stringify(channel.schedule ?? [])
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
    const ok = await saveChanges(selectedChannel);
    if (ok) {
      setIsEditMode(false);
    }
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
              <Radio size={34} /> PICKLE RSS Studio
            </h1>
            <p className="admin-subtitle">
              채널 메타데이터를 수정하고 XML 피드 결과를 즉시 확인할 수
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

        {selectedChannel ? (
          <main className="detail-wrap">
            <div className="detail-toolbar">
              <button type="button" className="ghost-btn" onClick={closeDetail}>
                <ArrowLeft size={16} /> 목록으로
              </button>
              <div className="detail-actions">
                <a
                  href={`/rss/${selectedChannel.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ghost-btn"
                >
                  XML Preview <ExternalLink size={14} />
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
                        resetChannel(selectedChannel.id);
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
                        isSaving === selectedChannel.id ||
                        !hasChanges(selectedChannel)
                      }
                    >
                      {isSaving === selectedChannel.id ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      {isSaving === selectedChannel.id ? "저장 중..." : "저장"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <article className="detail-card">
              <div className="channel-head">
                <span className="channel-id">ID: {selectedChannel.id}</span>
                <span className="admin-count">
                  상태 {hasChanges(selectedChannel) ? "수정됨" : "최신"}
                </span>
              </div>

              <div className="detail-grid">
                <div className="detail-main">
                  <div className="form-group">
                    <label>채널 타이틀</label>
                    <input
                      type="text"
                      value={selectedChannel.title || ""}
                      onChange={(e) =>
                        handleInputChange(
                          selectedChannel.id,
                          "title",
                          e.target.value,
                        )
                      }
                      placeholder="앱에 표시할 채널 이름"
                      disabled={!isEditMode}
                    />
                  </div>

                  <div className="form-group">
                    <label>스트리밍 소스 URL</label>
                    <div className="url-row">
                      <LinkIcon size={17} />
                      <input
                        type="text"
                        value={selectedChannel.stream_url || ""}
                        onChange={(e) =>
                          handleInputChange(
                            selectedChannel.id,
                            "stream_url",
                            e.target.value,
                          )
                        }
                        placeholder="https://.../playlist.m3u8"
                        disabled={!isEditMode}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>채널 상세 설명</label>
                    <textarea
                      value={selectedChannel.description || ""}
                      onChange={(e) =>
                        handleInputChange(
                          selectedChannel.id,
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
                  <h3 className="side-title">편성표 미리보기</h3>
                  {selectedChannel.schedule?.length ? (
                    <ul className="schedule-list">
                      {selectedChannel.schedule.map((item, idx) => (
                        <li key={`${selectedChannel.id}-schedule-${idx}`}>
                          <p className="schedule-time">
                            {item.startHour}:00 - {item.endHour}:00
                          </p>
                          <p className="schedule-title">{item.title}</p>
                          <p className="schedule-desc">{item.desc}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="schedule-empty">등록된 편성표가 없습니다.</p>
                  )}
                </aside>
              </div>
            </article>
          </main>
        ) : (
          <>
            <div className="admin-toolbar">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="채널 ID, 제목, URL로 검색"
              />
              <div className="admin-count">
                {filteredChannels.length}개 채널 표시 / 총 {channels.length}개
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
                    <div className="channel-head">
                      <span className="channel-id">ID: {ch.id}</span>
                      <span className="admin-count">
                        편성표 {ch.schedule?.length ?? 0}개
                      </span>
                    </div>

                    <div className="channel-body">
                      <h3 className="list-title">{ch.title || "제목 없음"}</h3>
                      <p className="list-url">{ch.stream_url || "URL 없음"}</p>
                      <p className="list-desc">
                        {ch.description || "설명이 없습니다."}
                      </p>
                    </div>

                    <div className="channel-meta">
                      <a
                        href={`/rss/${ch.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="channel-link"
                      >
                        XML Preview <ExternalLink size={14} />
                      </a>
                      <button
                        type="button"
                        className="channel-save"
                        onClick={() => openDetail(ch.id)}
                      >
                        <Eye size={16} /> 상세 보기
                      </button>
                    </div>
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
