import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BRIEFING_SECONDS,
  RESPONSE_SECONDS,
  ROUND_SCENE_COUNT,
  conversationLabels,
  conversationTabs,
  officeScenes,
  reactionOptions,
  scenario,
  titleTiers,
  type ChatEvent,
  type ChatScene,
  type ConversationId,
  type PlayerConversationId,
  type ReactionEmoji,
  type ScriptMessage,
} from "./data/officeContent";
import {
  getSceneMaxScore,
  scoreScene,
  type ChatFragment,
  type FragmentKind,
  type SceneScore,
} from "./game/scoring";

type Screen = "intro" | "game" | "summary";
type GamePhase = "briefing" | "active" | "transition";

interface ChatLine extends ScriptMessage {
  id: number;
  clock: string;
  sceneId?: string;
  isPlayer?: boolean;
  kind?: FragmentKind;
  pasted?: boolean;
}

interface SceneRecord {
  sceneId: string;
  fragments: ChatFragment[];
  result: SceneScore;
}

const NOT_OCCURRED = "情境本次未發生";
const formatSeconds = (seconds: number) => `${seconds.toFixed(1)}s`;
const formatPoints = (points: number) => `${points >= 0 ? "+" : ""}${points}`;
const getSceneKindLabel = (scene: ChatScene) =>
  scene.kind === "conflict" ? "界線攻防" : scene.kind === "casual" ? "日常聊天" : "一般通知";
const getScenePrompt = (scene: ChatScene) =>
  scene.events.map((event) => `${event.author}：${event.text}`).join(" / ");

const makeUnreadState = () =>
  Object.fromEntries(conversationTabs.map((tab) => [tab.id, false])) as Record<
    PlayerConversationId,
    boolean
  >;

const selectRoundScenes = () => {
  const rankedScenes = officeScenes.map((scene, index) => ({ index, scene }));

  for (let index = rankedScenes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [rankedScenes[index], rankedScenes[swapIndex]] = [
      rankedScenes[swapIndex],
      rankedScenes[index],
    ];
  }

  return rankedScenes
    .slice(0, ROUND_SCENE_COUNT)
    .map(({ scene }) => scene);
};

function App() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [phase, setPhase] = useState<GamePhase>("briefing");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [fragments, setFragments] = useState<ChatFragment[]>([]);
  const [timeLeft, setTimeLeft] = useState(BRIEFING_SECONDS);
  const [roundScenes, setRoundScenes] = useState<ChatScene[]>(selectRoundScenes);
  const [records, setRecords] = useState<SceneRecord[]>([]);
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<PlayerConversationId>("group");
  const [unreadConversations, setUnreadConversations] = useState(makeUnreadState);
  const [lastResult, setLastResult] = useState<SceneScore | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const startedAt = useRef(Date.now());
  const lineId = useRef(1);
  const selectedConversationRef = useRef<PlayerConversationId>("group");
  const draftWasPasted = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeScene = roundScenes[sceneIndex];

  const appendLines = useCallback(
    (
      messages: Array<
        ScriptMessage & { isPlayer?: boolean; kind?: FragmentKind; pasted?: boolean }
      >,
      clock: string,
      sceneId?: string,
    ) => {
      const nextLines = messages.map((message) => ({
        ...message,
        id: lineId.current++,
        clock,
        sceneId,
      }));
      setChatLines((current) => [...current, ...nextLines]);
      return nextLines;
    },
    [],
  );

  const markUnread = useCallback((conversation: ConversationId) => {
    if (
      conversation !== "system" &&
      conversation !== selectedConversationRef.current
    ) {
      setUnreadConversations((current) => ({ ...current, [conversation]: true }));
    }
  }, []);

  const appendSceneEvent = useCallback(
    (event: ChatEvent, scene: ChatScene) => {
      appendLines([event], scene.clock, scene.id);
      markUnread(event.conversation);
    },
    [appendLines, markUnread],
  );

  const beginScene = useCallback(
    (index: number) => {
      const scene = roundScenes[index];
      setSceneIndex(index);
      setDraft("");
      draftWasPasted.current = false;
      setFragments([]);
      setTimeLeft(RESPONSE_SECONDS);
      setPhase("active");
      startedAt.current = Date.now();
      scene.events
        .filter((event) => event.delayMs === 0)
        .forEach((event) => appendSceneEvent(event, scene));
    },
    [appendSceneEvent, roundScenes],
  );

  const startGame = () => {
    lineId.current = 1;
    setRecords([]);
    setChatLines([
      {
        id: lineId.current++,
        author: "系統",
        conversation: "system",
        clock: "09:00",
        text: "工作通知已開啟。每個聊天室都可能有新訊息，回完記得自己收尾。",
      },
    ]);
    setRoundScenes(selectRoundScenes());
    setSceneIndex(0);
    setDraft("");
    draftWasPasted.current = false;
    setFragments([]);
    selectedConversationRef.current = "group";
    setSelectedConversation("group");
    setUnreadConversations(makeUnreadState());
    setLastResult(null);
    setCopyStatus("idle");
    setTimeLeft(BRIEFING_SECONDS);
    setPhase("briefing");
    setScreen("game");
    startedAt.current = Date.now();
  };

  const resolveScene = useCallback(
    (endedByTimeout = false) => {
      if (phase !== "active") return;

      const result = scoreScene(fragments, activeScene, endedByTimeout);
      if (result.scriptReply) {
        const isSystemReply = result.scriptReply.startsWith("[系統]");
        appendLines(
          [
            {
              author: isSystemReply ? "系統" : activeScene.responseAuthor ?? "系統",
              conversation: isSystemReply ? "system" : activeScene.expectedConversation,
              text: result.scriptReply.replace("[系統] ", ""),
            },
          ],
          activeScene.clock,
          activeScene.id,
        );
      }
      appendLines(
        [
          {
            author: "系統",
            conversation: "system",
            text: `本則 ${formatPoints(result.total)}｜${result.feedback}`,
          },
        ],
        activeScene.clock,
        activeScene.id,
      );
      setRecords((current) => [
        ...current,
        { sceneId: activeScene.id, fragments, result },
      ]);
      setLastResult(result);
      setDraft("");
      draftWasPasted.current = false;
      setTimeLeft(0);
      setPhase("transition");
    },
    [activeScene, appendLines, fragments, phase],
  );

  const sendFragment = useCallback(
    (kind: FragmentKind, text: string, pasted = false) => {
      if (phase !== "active") return;

      const sentAtSeconds = Math.min(
        RESPONSE_SECONDS,
        Math.max(0.1, (Date.now() - startedAt.current) / 1000),
      );
      const fragment: ChatFragment = {
        kind,
        text,
        sentAtSeconds,
        conversation: selectedConversation,
        pasted,
      };
      setFragments((current) => [...current, fragment]);
      appendLines(
        [
          {
            author: "你",
            conversation: selectedConversation,
            text,
            isPlayer: true,
            kind,
            pasted,
          },
        ],
        activeScene.clock,
        activeScene.id,
      );
      window.setTimeout(() => inputRef.current?.focus(), 0);
    },
    [activeScene.clock, activeScene.id, appendLines, phase, selectedConversation],
  );

  const submitText = useCallback(() => {
    const text = draft.trim();
    if (text.length === 0) return;
    sendFragment("text", text, draftWasPasted.current);
    setDraft("");
    draftWasPasted.current = false;
  }, [draft, sendFragment]);

  const sendEmoji = (emoji: ReactionEmoji) => sendFragment("emoji", emoji);
  const sendRead = () => sendFragment("read", "已讀");

  const selectConversation = (conversation: PlayerConversationId) => {
    selectedConversationRef.current = conversation;
    setSelectedConversation(conversation);
    setUnreadConversations((current) => ({ ...current, [conversation]: false }));
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (screen !== "game" || phase !== "active") return;

    const timers = activeScene.events
      .filter((event) => event.delayMs > 0)
      .map((event) =>
        window.setTimeout(() => appendSceneEvent(event, activeScene), event.delayMs),
      );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activeScene, appendSceneEvent, phase, screen]);

  useEffect(() => {
    if (screen !== "game" || phase === "transition") return;

    if (phase === "active") inputRef.current?.focus();
    let completed = false;
    const duration = phase === "briefing" ? BRIEFING_SECONDS : RESPONSE_SECONDS;
    const timer = window.setInterval(() => {
      const nextTimeLeft = Math.max(
        0,
        duration - (Date.now() - startedAt.current) / 1000,
      );
      setTimeLeft(nextTimeLeft);
      if (!completed && nextTimeLeft <= 0) {
        completed = true;
        if (phase === "briefing") beginScene(0);
        else resolveScene(true);
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [beginScene, phase, resolveScene, screen]);

  useEffect(() => {
    if (screen !== "game" || phase !== "transition") return;

    const timer = window.setTimeout(() => {
      if (sceneIndex === roundScenes.length - 1) {
        setScreen("summary");
        return;
      }
      beginScene(sceneIndex + 1);
    }, 1100);

    return () => window.clearTimeout(timer);
  }, [beginScene, phase, roundScenes.length, sceneIndex, screen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLines, selectedConversation]);

  const totalScore = useMemo(
    () => records.reduce((sum, record) => sum + record.result.total, 0),
    [records],
  );
  const maxScore = useMemo(
    () => roundScenes.reduce((sum, scene) => sum + getSceneMaxScore(scene), 0),
    [roundScenes],
  );
  const averageReaction = useMemo(() => {
    if (records.length === 0) return 0;
    return (
      records.reduce((sum, record) => sum + record.result.reactionSeconds, 0) /
      records.length
    );
  }, [records]);
  const sentMessages = useMemo(
    () => records.reduce((sum, record) => sum + record.result.messageCount, 0),
    [records],
  );
  const correctJudgements = useMemo(
    () => records.filter((record) => record.result.correct).length,
    [records],
  );
  const title =
    titleTiers.find((tier) => totalScore / Math.max(1, maxScore) >= tier.minRatio) ??
    titleTiers[titleTiers.length - 1];
  const progress = ((sceneIndex + 1) / roundScenes.length) * 100;
  const timerProgress = (timeLeft / RESPONSE_SECONDS) * 100;
  const visibleChatLines = useMemo(
    () =>
      chatLines.filter(
        (line) =>
          line.conversation === "system" || line.conversation === selectedConversation,
      ),
    [chatLines, selectedConversation],
  );
  const recordBySceneId = useMemo(
    () => new Map(records.map((record) => [record.sceneId, record])),
    [records],
  );
  const reportRows = useMemo(
    () =>
      officeScenes.map((scene) => ({
        scene,
        record: recordBySceneId.get(scene.id),
      })),
    [recordBySceneId],
  );

  const formatRecordReply = (record?: SceneRecord) =>
    record
      ? record.fragments.length > 0
        ? record.fragments
            .map(
              (fragment) =>
                `[${conversationLabels[fragment.conversation]}] ${fragment.text}${
                  fragment.pasted ? " [貼上]" : ""
                }`,
            )
            .join(" / ")
        : "未回答"
      : NOT_OCCURRED;

  const buildTranscriptText = () => {
    const transcriptLines = chatLines.map(
      (line) =>
        `[${line.clock}] [${conversationLabels[line.conversation]}] ${line.author}：${line.text}${
          line.pasted ? " [貼上]" : ""
        }`,
    );
    const resultLines = reportRows.flatMap(({ scene, record }, index) => [
      `${String(index + 1).padStart(2, "0")}. ${scene.headline}｜${getSceneKindLabel(scene)}`,
      `題目：${getScenePrompt(scene)}`,
      `回應：${formatRecordReply(record)}`,
      `評價：${
        record
          ? `${formatPoints(record.result.total)} / ${record.result.maxScore}｜${record.result.feedback}`
          : NOT_OCCURRED
      }`,
      "",
    ]);
    return [
      "口誅筆伐｜社畜模式對話紀錄",
      `總分：${totalScore.toLocaleString()} / ${maxScore.toLocaleString()}`,
      `平均判斷：${formatSeconds(averageReaction)}`,
      `正確判斷：${correctJudgements} / ${roundScenes.length}`,
      "",
      "=== 對話紀錄 ===",
      ...transcriptLines,
      "",
      "=== 判定摘要 ===",
      ...resultLines,
      "",
    ].join("\r\n");
  };

  const fallbackCopyText = (text: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  };

  const copyTranscript = async () => {
    const text = buildTranscriptText();
    let copied = fallbackCopyText(text);

    if (!copied && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    setCopyStatus(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyStatus("idle"), 2400);
  };

  if (screen === "intro") {
    return (
      <main className="app-shell intro-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <section className="intro-card">
          <p className="eyebrow">OFFICE CHAT SIMULATOR</p>
          <h1>
            口誅
            <span>筆伐</span>
          </h1>
          <p className="intro-copy">
            工作群組與私訊會交錯跳出。每一局都是一段忙亂的聊天室。
            <strong>切分頁、連發短句、丟 emoji，再自己決定何時收尾。</strong>
          </p>
          <div className="scenario-panel">
            <p className="panel-label">本週聊天室</p>
            <h2>{scenario.title}</h2>
            <p>
              每局從 {officeScenes.length} 個情境隨機抽選 {ROUND_SCENE_COUNT} 個，
              混合攻防、公告、群組閒聊與私人對話。
            </p>
          </div>
          <div className="rule-row">
            <div>
              <b>{ROUND_SCENE_COUNT}</b>
              <span>隨機情境</span>
            </div>
            <div>
              <b>30</b>
              <span>秒自由回覆</span>
            </div>
            <div>
              <b>0</b>
              <span>生成式 AI</span>
            </div>
          </div>
          <button className="primary-button" type="button" onClick={startGame}>
            <span>進入聊天室</span>
            <i>START SHIFT</i>
          </button>
          <p className="fine-print">純前端腳本 · 本機判定 · 無後端與付費 API</p>
        </section>
      </main>
    );
  }

  if (screen === "summary") {
    return (
      <main className="app-shell summary-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <section className="summary-card">
          <p className="eyebrow">SHIFT COMPLETE</p>
          <h1>本週結算</h1>
          <p className="summary-title">{title.title}</p>
          <p className="summary-description">{title.description}</p>
          <div className="score-orb">
            <span>節奏分</span>
            <strong>{totalScore.toLocaleString()}</strong>
            <small>/ {maxScore.toLocaleString()}</small>
          </div>
          <div className="summary-stats">
            <div>
              <span>平均判斷</span>
              <strong>{formatSeconds(averageReaction)}</strong>
            </div>
            <div>
              <span>送出訊息</span>
              <strong>{sentMessages}</strong>
            </div>
            <div>
              <span>正確判斷</span>
              <strong>
                {correctJudgements} / {roundScenes.length}
              </strong>
            </div>
          </div>
          <section className="transcript-panel">
            <div className="transcript-head">
              <div>
                <p className="panel-label">CHAT TRANSCRIPT</p>
                <h2>對話歷程與判定</h2>
              </div>
              <button className="copy-button" type="button" onClick={copyTranscript}>
                {copyStatus === "copied"
                  ? "已複製"
                  : copyStatus === "failed"
                    ? "複製失敗"
                    : "複製文字"}
              </button>
            </div>
            <p className="copy-hint" aria-live="polite">
              {copyStatus === "copied"
                ? "已將完整對話與固定排序評價複製到剪貼簿。"
                : copyStatus === "failed"
                  ? "瀏覽器未允許存取剪貼簿，請稍後再試。"
                  : "未抽中的題目會統一標記為「情境本次未發生」。"}
            </p>
            <div className="transcript-feed">
              {chatLines.map((line) => (
                <article className="transcript-line" key={line.id}>
                  <small>
                    {line.clock} · {conversationLabels[line.conversation]}
                  </small>
                  <strong>{line.author}</strong>
                  <p>{line.text}</p>
                </article>
              ))}
            </div>
            <div className="result-history">
              <p className="panel-label">逐則評價 · 題庫固定排序</p>
              {reportRows.map(({ scene, record }, index) => (
                <article
                  className={`result-row ${record ? "" : "result-row-muted"}`}
                  key={scene.id}
                >
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div>
                    <strong>{scene.headline}</strong>
                    <small>{getSceneKindLabel(scene)}</small>
                    <p>回應：{formatRecordReply(record)}</p>
                    <p>
                      評價：
                      {record
                        ? `${formatPoints(record.result.total)} / ${record.result.maxScore}｜${record.result.feedback}`
                        : NOT_OCCURRED}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <button className="primary-button" type="button" onClick={startGame}>
            <span>再來一週</span>
            <i>ANOTHER SHIFT</i>
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell game-shell">
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark">口</span>
          <div>
            <strong>口誅筆伐</strong>
            <small>OFFICE CHAT SIMULATOR</small>
          </div>
        </div>
        <div className="top-score">
          <small>目前節奏分</small>
          <strong>{totalScore.toLocaleString()}</strong>
        </div>
      </div>
      <div className="round-progress">
        <div style={{ width: `${progress}%` }} />
      </div>

      {phase === "briefing" ? (
        <section className="battlefield briefing-card">
          <div className="briefing-title">
            <div>
              <p className="panel-label">SHIFT BRIEFING</p>
              <h2>聊天室操作說明</h2>
            </div>
            <strong>{formatSeconds(timeLeft)}</strong>
          </div>
          <div className="timer-track">
            <span style={{ width: `${(timeLeft / BRIEFING_SECONDS) * 100}%` }} />
          </div>
          <div className="situation-copy">
            <span>本週設定</span>
            <p>
              每個情境持續 30 秒。文字、emoji 與已讀都可以連續送出，
              按「結束回覆」才會進入下一則。貼上可以玩梗，但不計手速且限制最高分。
            </p>
          </div>
          <div className="control-grid">
            {scenario.controls.map((control, index) => (
              <p key={control}>
                <b>0{index + 1}</b>
                {control}
              </p>
            ))}
          </div>
          <button className="next-button" type="button" onClick={() => beginScene(0)}>
            我知道了，打開通知
            <span>→</span>
          </button>
        </section>
      ) : (
        <section className="conversation-layout">
          <nav className="conversation-sidebar" aria-label="聊天室分頁">
            <div className="sidebar-title">
              <p className="panel-label">MESSAGES</p>
              <strong>工作聊天室</strong>
            </div>
            {conversationTabs.map((tab) => (
              <button
                className={selectedConversation === tab.id ? "active" : ""}
                type="button"
                key={tab.id}
                onClick={() => selectConversation(tab.id)}
              >
                <span className="tab-avatar">{tab.avatar}</span>
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.subtitle}</small>
                </span>
                {unreadConversations[tab.id] && <i>新訊息</i>}
              </button>
            ))}
          </nav>

          <section className="chat-card">
            <header className="chat-header">
              <div>
                <p className="panel-label">LIVE OFFICE CHAT</p>
                <h2>{conversationLabels[selectedConversation]}</h2>
              </div>
              <div className="chat-timer">
                <small>
                  情境 {sceneIndex + 1} / {roundScenes.length}
                </small>
                <strong className={timeLeft <= 3 && phase === "active" ? "danger" : ""}>
                  {phase === "transition" ? "下一則" : formatSeconds(timeLeft)}
                </strong>
              </div>
            </header>
            <div className="timer-track">
              <span
                className={timeLeft <= 3 && phase === "active" ? "danger-bg" : ""}
                style={{ width: `${phase === "transition" ? 0 : timerProgress}%` }}
              />
            </div>
            <div className="chat-feed">
              {visibleChatLines.map((line) => (
                <div
                  className={`chat-line ${
                    line.conversation === "system"
                      ? "chat-system"
                      : line.conversation === "group"
                        ? "chat-group"
                        : "chat-private"
                  } ${line.isPlayer ? "chat-player" : ""}`}
                  key={line.id}
                >
                  <span className="chat-clock">{line.clock}</span>
                  <span className="channel-badge">
                    [{conversationLabels[line.conversation]}]
                  </span>
                  <strong>{line.author}</strong>
                  <div className="chat-message">
                    <p>{line.text}</p>
                    {line.pasted && <span className="paste-chip">貼上</span>}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-composer">
              <div className="composer-meta">
                <span className="composer-channel">
                  [{conversationLabels[selectedConversation]}]
                </span>
                <small>可以貼上玩梗，但貼上文字不計手速且限制最高分</small>
              </div>
              <div className="emoji-picker" aria-label="emoji 快速訊息">
                {reactionOptions.map((emoji) => (
                  <button
                    aria-label={`傳送 ${emoji}`}
                    type="button"
                    key={emoji}
                    disabled={phase !== "active"}
                    onClick={() => sendEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                ref={inputRef}
                value={draft}
                maxLength={72}
                disabled={phase !== "active"}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (event.target.value.length === 0) draftWasPasted.current = false;
                }}
                onPaste={() => {
                  draftWasPasted.current = true;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submitText();
                  }
                }}
                placeholder={
                  phase === "transition"
                    ? "下一則工作通知準備中..."
                    : `輸入訊息，按 Enter 送到${conversationLabels[selectedConversation]}...`
                }
              />
              <div className="composer-actions">
                <small>本則已送出 {fragments.length} 則 · 自己決定何時收尾</small>
                <div>
                  <button
                    className="read-button"
                    type="button"
                    disabled={phase !== "active"}
                    onClick={sendRead}
                  >
                    已讀
                  </button>
                  <button
                    type="button"
                    disabled={phase !== "active" || draft.trim().length === 0}
                    onClick={submitText}
                  >
                    送出訊息
                  </button>
                  <button
                    className="finish-button"
                    type="button"
                    disabled={phase !== "active"}
                    onClick={() => resolveScene()}
                  >
                    結束回覆
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="context-card">
            <p className="panel-label">
              {getSceneKindLabel(activeScene)} · {activeScene.clock}
            </p>
            <h2>{activeScene.headline}</h2>
            <div>
              <span>事件背景</span>
              <p>{activeScene.situation}</p>
            </div>
            <div className="weak-point">
              <span>回覆方向</span>
              <p>{activeScene.guidance}</p>
            </div>
            <div>
              <span>可用節奏</span>
              <ul>
                {activeScene.hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </div>
            <div className="target-channel">
              <span>主要聊天室</span>
              <strong>[{conversationLabels[activeScene.expectedConversation]}]</strong>
              {activeScene.expectedConversation !== selectedConversation && (
                <small>切換左側聊天室查看新訊息</small>
              )}
              {activeScene.events.length > 1 && (
                <small>本情境期間還可能出現其他訊息</small>
              )}
            </div>
            {lastResult && (
              <div className="last-score">
                <span>上一則判定</span>
                <strong>{formatPoints(lastResult.total)}</strong>
                <small>{lastResult.feedback}</small>
              </div>
            )}
          </aside>
        </section>
      )}
    </main>
  );
}

export default App;
