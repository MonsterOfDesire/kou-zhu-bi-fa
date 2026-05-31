import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BRIEFING_SECONDS,
  ROUND_PULSE_COUNT,
  RESPONSE_SECONDS,
  channelLabels,
  officeStream,
  reactionOptions,
  scenario,
  titleTiers,
  type OfficePulse,
  type PlayerChannel,
  type ReactionEmoji,
  type ScriptMessage,
} from "./data/officeContent";
import { scoreReply, type ReplyFragment } from "./game/scoring";

type Screen = "intro" | "game" | "summary";
type GamePhase = "briefing" | "active" | "transition";
type QuickAction = "read" | "reaction" | "text" | "timeout";

interface ChatLine extends ScriptMessage {
  id: number;
  clock: string;
  isPlayer?: boolean;
  pulseId?: string;
  playerReaction?: string;
}

interface PulseResult {
  points: number;
  reactionSeconds: number;
  correct: boolean;
  feedback: string;
  messageCount: number;
}

interface PulseRecord {
  pulseId: string;
  answer: string;
  result: PulseResult;
}

const formatSeconds = (seconds: number) => `${seconds.toFixed(1)}s`;
const formatPoints = (points: number) => `${points >= 0 ? "+" : ""}${points}`;
const NOT_OCCURRED = "情境本次未發生";

const getBeat = (pulse: OfficePulse) => {
  if (pulse.type !== "debate") return null;
  return scenario.beats.find((beat) => beat.id === pulse.beatId) ?? null;
};

const getPulseChannel = (pulse: OfficePulse): PlayerChannel =>
  pulse.type === "ambient" ? pulse.channel : getBeat(pulse)!.expectedChannel;

const getPulseClock = (pulse: OfficePulse) =>
  pulse.type === "ambient" ? pulse.clock : getBeat(pulse)!.clock;

const getPulseHeadline = (pulse: OfficePulse) =>
  pulse.type === "ambient" ? pulse.headline : getBeat(pulse)!.headline;

const getPulsePrompt = (pulse: OfficePulse) =>
  pulse.type === "ambient"
    ? `${pulse.author}：${pulse.text}`
    : getBeat(pulse)!.incoming.map((message) => `${message.author}：${message.text}`).join(" / ");

const selectRoundPulses = () => {
  const rankedPulses = officeStream.map((pulse, index) => ({ index, pulse }));

  for (let index = rankedPulses.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [rankedPulses[index], rankedPulses[swapIndex]] = [rankedPulses[swapIndex], rankedPulses[index]];
  }

  return rankedPulses
    .slice(0, ROUND_PULSE_COUNT)
    .sort((first, second) => first.index - second.index)
    .map(({ pulse }) => pulse);
};

function App() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [phase, setPhase] = useState<GamePhase>("briefing");
  const [pulseIndex, setPulseIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [fragments, setFragments] = useState<ReplyFragment[]>([]);
  const [timeLeft, setTimeLeft] = useState(BRIEFING_SECONDS);
  const [roundPulses, setRoundPulses] = useState<OfficePulse[]>(selectRoundPulses);
  const [records, setRecords] = useState<PulseRecord[]>([]);
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<PlayerChannel>("group");
  const [unreadChannels, setUnreadChannels] = useState<Record<PlayerChannel, boolean>>({
    group: false,
    private: false,
  });
  const [activeLineId, setActiveLineId] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<PulseResult | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const startedAt = useRef(Date.now());
  const lineId = useRef(1);
  const selectedChannelRef = useRef<PlayerChannel>("group");
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activePulse = roundPulses[pulseIndex];
  const activeBeat = getBeat(activePulse);
  const activeChannel = getPulseChannel(activePulse);

  const appendLines = useCallback(
    (messages: ScriptMessage[], clock: string, pulseId?: string) => {
      const nextLines = messages.map((message) => ({
        ...message,
        id: lineId.current++,
        clock,
        pulseId,
      }));
      setChatLines((current) => [...current, ...nextLines]);
      return nextLines;
    },
    [],
  );

  const beginPulse = useCallback(
    (index: number) => {
      const pulse = roundPulses[index];
      const beat = getBeat(pulse);
      const incoming =
        pulse.type === "ambient"
          ? [{ author: pulse.author, channel: pulse.channel, text: pulse.text }]
          : beat!.incoming;
      const nextLines = appendLines(incoming, getPulseClock(pulse), pulse.id);

      setPulseIndex(index);
      setDraft("");
      setFragments([]);
      setTimeLeft(RESPONSE_SECONDS);
      setPhase("active");
      setActiveLineId(nextLines[nextLines.length - 1]?.id ?? null);
      startedAt.current = Date.now();

      const channel = getPulseChannel(pulse);
      if (channel !== selectedChannelRef.current) {
        setUnreadChannels((current) => ({ ...current, [channel]: true }));
      }
    },
    [appendLines, roundPulses],
  );

  const startGame = () => {
    lineId.current = 1;
    setRecords([]);
    setChatLines([
      {
        id: lineId.current++,
        author: "系統",
        channel: "system",
        clock: "09:00",
        text: "工作通知已開啟。不是每一則訊息都值得長篇大論。",
      },
    ]);
    setRoundPulses(selectRoundPulses());
    setPulseIndex(0);
    setDraft("");
    setFragments([]);
    selectedChannelRef.current = "group";
    setSelectedChannel("group");
    setUnreadChannels({ group: false, private: false });
    setActiveLineId(null);
    setLastResult(null);
    setCopyStatus("idle");
    setTimeLeft(BRIEFING_SECONDS);
    setPhase("briefing");
    setScreen("game");
    startedAt.current = Date.now();
  };

  const finishPulse = useCallback(
    (result: PulseResult, answer: string) => {
      appendLines(
        [
          {
            author: "系統",
            channel: "system",
            text: `本則 ${formatPoints(result.points)}｜${result.feedback}`,
          },
        ],
        getPulseClock(activePulse),
      );
      setRecords((current) => [...current, { pulseId: activePulse.id, answer, result }]);
      setLastResult(result);
      setDraft("");
      setTimeLeft(0);
      setPhase("transition");
    },
    [activePulse, appendLines],
  );

  const resolveDebate = useCallback(
    (endedByTimeout = false) => {
      if (phase !== "active" || !activeBeat) return;

      const score = scoreReply(fragments, activeBeat, endedByTimeout);
      const isSystemReply = score.scriptReply.startsWith("[系統]");
      const scriptText = score.scriptReply.replace("[系統] ", "");
      const matchText =
        score.matchedConcepts.length > 0
          ? `命中：${score.matchedConcepts.join("、")}`
          : score.isOffTopic
            ? "沒有打中矛盾核心"
            : "沒有送出回覆";

      appendLines(
        [
          {
            author: isSystemReply ? "系統" : activeBeat.responseAuthor,
            channel: isSystemReply ? "system" : activeBeat.expectedChannel,
            text: scriptText,
          },
        ],
        activeBeat.clock,
      );
      finishPulse(
        {
          points: score.total,
          reactionSeconds: score.reactionSeconds,
          correct: score.total >= 300 && score.reachedExpectedChannel,
          feedback: `${matchText}｜頻道${score.reachedExpectedChannel ? "正確" : "錯誤"}`,
          messageCount: score.messageCount,
        },
        fragments.length > 0 ? fragments.map((fragment) => fragment.text).join(" / ") : "未回答",
      );
    },
    [activeBeat, appendLines, finishPulse, fragments, phase],
  );

  const resolveQuickAction = useCallback(
    (action: QuickAction, reaction?: ReactionEmoji, textReply?: string) => {
      if (phase !== "active") return;

      const reactionSeconds = Math.min(
        RESPONSE_SECONDS,
        Math.max(0.1, (Date.now() - startedAt.current) / 1000),
      );
      const speedBonus = Math.round(
        90 * Math.max(0, (RESPONSE_SECONDS - reactionSeconds) / RESPONSE_SECONDS),
      );
      const answer =
        action === "read"
          ? "已讀"
          : action === "reaction"
            ? reaction!
            : action === "text"
              ? textReply ?? "文字回覆"
              : "未回答";

      if (action === "read" || action === "reaction") {
        setChatLines((current) =>
          current.map((line) =>
            line.id === activeLineId
              ? { ...line, playerReaction: action === "read" ? "已讀" : reaction }
              : line,
          ),
        );
      }

      if (activePulse.type === "debate") {
        const label = action === "read" ? "只按已讀" : `只按 ${reaction}`;
        finishPulse(
          {
            points: action === "timeout" ? -80 : -140,
            reactionSeconds,
            correct: false,
            feedback:
              action === "timeout"
                ? "你讓不合理要求直接滑過去了"
                : `${label}沒有守住工作界線，這則應該用文字回覆`,
            messageCount: 0,
          },
          answer,
        );
        return;
      }

      const ambient = activePulse;
      const isAccepted =
        action === "read"
          ? ambient.allowRead
          : action === "reaction"
            ? ambient.acceptedReactions.includes(reaction!)
            : false;
      const points =
        action === "timeout"
          ? -50
          : action === "text"
            ? -180
            : isAccepted
              ? (action === "read" ? 100 : 130) + speedBonus
              : -140;
      const feedback =
        action === "timeout"
          ? "訊息飄過去了，你沒有做出判斷"
          : action === "text"
            ? "一般通知不需要主動長篇回覆，你在群組裡搶戲了"
            : isAccepted
              ? action === "read"
                ? "判斷正確：這則訊息已讀即可"
                : `判斷正確：${reaction} 放在這裡很自然`
              : `${reaction} 放在「${ambient.headline}」不太合時宜`;

      finishPulse(
        {
          points,
          reactionSeconds,
          correct: isAccepted,
          feedback,
          messageCount: action === "text" ? 1 : 0,
        },
        answer,
      );
    },
    [activeLineId, activePulse, finishPulse, phase],
  );

  const submitText = useCallback(() => {
    const text = draft.trim();
    if (phase !== "active" || text.length === 0) return;

    const sentAtSeconds = Math.min(
      RESPONSE_SECONDS,
      Math.max(0.1, (Date.now() - startedAt.current) / 1000),
    );
    setChatLines((current) => [
      ...current,
      {
        id: lineId.current++,
        author: "你",
        channel: selectedChannel,
        clock: getPulseClock(activePulse),
        text,
        isPlayer: true,
        pulseId: activePulse.id,
      },
    ]);
    setDraft("");

    if (activePulse.type === "ambient") {
      resolveQuickAction("text", undefined, text);
      return;
    }

    setFragments((current) => [...current, { text, channel: selectedChannel, sentAtSeconds }]);
    inputRef.current?.focus();
  }, [activePulse, draft, phase, resolveQuickAction, selectedChannel]);

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
        if (phase === "briefing") beginPulse(0);
        else if (activePulse.type === "debate") resolveDebate(true);
        else resolveQuickAction("timeout");
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [activePulse.type, beginPulse, phase, resolveDebate, resolveQuickAction, screen]);

  useEffect(() => {
    if (screen !== "game" || phase !== "transition") return;

    const timer = window.setTimeout(() => {
      if (pulseIndex === roundPulses.length - 1) {
        setScreen("summary");
        return;
      }
      beginPulse(pulseIndex + 1);
    }, 950);

    return () => window.clearTimeout(timer);
  }, [beginPulse, phase, pulseIndex, roundPulses.length, screen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLines, selectedChannel]);

  const totalScore = useMemo(
    () => records.reduce((sum, record) => sum + record.result.points, 0),
    [records],
  );
  const averageReaction = useMemo(() => {
    if (records.length === 0) return 0;
    return (
      records.reduce((sum, record) => sum + record.result.reactionSeconds, 0) /
      records.length
    );
  }, [records]);
  const typedFragments = useMemo(
    () => records.reduce((sum, record) => sum + record.result.messageCount, 0),
    [records],
  );
  const correctJudgements = useMemo(
    () => records.filter((record) => record.result.correct).length,
    [records],
  );
  const fullPoolMaxScore =
    scenario.beats.length * 1000 +
    officeStream.filter((pulse) => pulse.type === "ambient").length * 220;
  const maxScore = roundPulses.reduce(
    (sum, pulse) => sum + (pulse.type === "debate" ? 1000 : 220),
    0,
  );
  const title =
    titleTiers.find(
      (tier) => totalScore >= Math.round((tier.minScore / fullPoolMaxScore) * maxScore),
    ) ??
    titleTiers[titleTiers.length - 1];
  const progress = ((pulseIndex + 1) / roundPulses.length) * 100;
  const timerProgress = (timeLeft / RESPONSE_SECONDS) * 100;
  const visibleChatLines = useMemo(
    () =>
      chatLines.filter(
        (line) => line.channel === "system" || line.channel === selectedChannel,
      ),
    [chatLines, selectedChannel],
  );
  const recordByPulseId = useMemo(
    () => new Map(records.map((record) => [record.pulseId, record])),
    [records],
  );
  const reportRows = useMemo(
    () =>
      officeStream.map((pulse) => ({
        headline: getPulseHeadline(pulse),
        prompt: getPulsePrompt(pulse),
        pulse,
        record: recordByPulseId.get(pulse.id),
      })),
    [recordByPulseId],
  );

  const buildTranscriptText = () => {
    const transcriptLines = chatLines.flatMap((line) => [
      `[${line.clock}] [${channelLabels[line.channel]}] ${line.author}：${line.text}`,
      ...(line.playerReaction ? [`  ↳ 你的反應：${line.playerReaction}`] : []),
    ]);
    const resultLines = reportRows.flatMap(
      ({ headline, prompt, pulse, record }, index) => [
        `${String(index + 1).padStart(2, "0")}. ${headline}｜${
          pulse.type === "debate" ? "文字反擊" : "快速判斷"
        }`,
        `題目：${prompt}`,
        `回應：${record?.answer ?? NOT_OCCURRED}`,
        `評價：${
          record ? `${formatPoints(record.result.points)}｜${record.result.feedback}` : NOT_OCCURRED
        }`,
        "",
      ],
    );
    return [
      "口誅筆伐｜社畜模式對話紀錄",
      `總分：${totalScore.toLocaleString()} / ${maxScore.toLocaleString()}`,
      `平均判斷：${formatSeconds(averageReaction)}`,
      `正確判斷：${correctJudgements} / ${roundPulses.length}`,
      "",
      "=== 對話紀錄 ===",
      ...transcriptLines,
      "",
      "=== 判定摘要 ===",
      ...(resultLines.length > 0 ? resultLines : ["尚無判定紀錄"]),
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

  const selectChannel = (channel: PlayerChannel) => {
    selectedChannelRef.current = channel;
    setSelectedChannel(channel);
    setUnreadChannels((current) => ({ ...current, [channel]: false }));
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  if (screen === "intro") {
    return (
      <main className="app-shell intro-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <section className="intro-card">
          <p className="eyebrow">OFFICE CHAT RHYTHM</p>
          <h1>
            口誅
            <span>筆伐</span>
          </h1>
          <p className="intro-copy">
            工作群組會持續跳出訊息。不是每一則都值得開戰。
            <strong>已讀、表情、回嘴：在對的時機做對的事。</strong>
          </p>

          <div className="scenario-panel">
            <p className="panel-label">本週訊息流</p>
            <h2>{scenario.title}</h2>
            <p>每局從 19 則題庫隨機抽選 10 則，混合不合理要求、日常通知與辦公室閒聊。</p>
          </div>

          <div className="rule-row">
            <div>
              <b>{ROUND_PULSE_COUNT}</b>
              <span>隨機抽題</span>
            </div>
            <div>
              <b>30</b>
              <span>秒內判斷</span>
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
              <span>文字片段</span>
              <strong>{typedFragments}</strong>
            </div>
            <div>
              <span>正確判斷</span>
              <strong>{correctJudgements} / {roundPulses.length}</strong>
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
                ? "已將完整對話與評價複製到剪貼簿。"
                : copyStatus === "failed"
                  ? "瀏覽器未允許存取剪貼簿，請稍後再試。"
                  : "包含聊天室逐行記錄、你的反應與每則得分。"}
            </p>
            <div className="transcript-feed">
              {chatLines.map((line) => (
                <article className="transcript-line" key={line.id}>
                  <small>
                    {line.clock} · {channelLabels[line.channel]}
                  </small>
                  <strong>{line.author}</strong>
                  <p>{line.text}</p>
                  {line.playerReaction && <em>你的反應：{line.playerReaction}</em>}
                </article>
              ))}
            </div>
            <div className="result-history">
              <p className="panel-label">逐則評價 · 題庫固定排序</p>
              {reportRows.map(({ headline, pulse, record }, index) => (
                <article
                  className={`result-row ${record ? "" : "result-row-muted"}`}
                  key={pulse.id}
                >
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div>
                    <strong>{headline}</strong>
                    <small>{pulse.type === "debate" ? "文字反擊" : "快速判斷"}</small>
                    <p>回應：{record?.answer ?? NOT_OCCURRED}</p>
                    <p>
                      評價：
                      {record
                        ? `${formatPoints(record.result.points)}｜${record.result.feedback}`
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
            <small>OFFICE CHAT RHYTHM</small>
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
              <h2>聊天室節奏說明</h2>
            </div>
            <strong>{formatSeconds(timeLeft)}</strong>
          </div>
          <div className="timer-track">
            <span style={{ width: `${(timeLeft / BRIEFING_SECONDS) * 100}%` }} />
          </div>
          <div className="situation-copy">
            <span>本週設定</span>
            <p>
              群組訊息會持續出現。日常通知通常只要已讀或合宜表情；
              遇到不合理要求才需要打字反擊。
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
          <button className="next-button" type="button" onClick={() => beginPulse(0)}>
            我知道了，打開通知
            <span>→</span>
          </button>
        </section>
      ) : (
        <section className="conversation-layout">
          <section className="chat-card">
            <header className="chat-header">
              <div>
                <p className="panel-label">LIVE OFFICE CHAT</p>
                <h2>{channelLabels[selectedChannel]}</h2>
              </div>
              <div className="chat-timer">
                <small>訊息 {pulseIndex + 1} / {roundPulses.length}</small>
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

            <div className="chat-tabs" aria-label="聊天室分頁">
              {(["group", "private"] as PlayerChannel[]).map((channel) => (
                <button
                  className={selectedChannel === channel ? "active" : ""}
                  type="button"
                  key={channel}
                  onClick={() => selectChannel(channel)}
                >
                  <span>{channelLabels[channel]}</span>
                  {unreadChannels[channel] && <i>新訊息</i>}
                </button>
              ))}
            </div>

            <div className="chat-feed">
              {visibleChatLines.map((line) => (
                <div
                  className={`chat-line chat-${line.channel} ${
                    line.isPlayer ? "chat-player" : ""
                  }`}
                  key={line.id}
                >
                  <span className="chat-clock">{line.clock}</span>
                  <span className="channel-badge">[{channelLabels[line.channel]}]</span>
                  <strong>{line.author}</strong>
                  <div className="chat-message">
                    <p>{line.text}</p>
                    {line.playerReaction && (
                      <span className="reaction-chip">你 · {line.playerReaction}</span>
                    )}
                    {line.id === activeLineId &&
                      phase === "active" &&
                      !line.isPlayer &&
                      line.channel === selectedChannel && (
                        <div className="message-actions">
                          <button type="button" onClick={() => resolveQuickAction("read")}>
                            已讀
                          </button>
                          {reactionOptions.map((reaction) => (
                            <button
                              aria-label={`對這則訊息回應 ${reaction}`}
                              type="button"
                              key={reaction}
                              onClick={() => resolveQuickAction("reaction", reaction)}
                            >
                              {reaction}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-composer">
              <div className="composer-meta">
                <span className={`composer-channel channel-${selectedChannel}`}>
                  [{channelLabels[selectedChannel]}]
                </span>
                <small>先判斷是否值得回覆；亂回一般通知會扣分</small>
              </div>
              <input
                ref={inputRef}
                value={draft}
                maxLength={52}
                disabled={phase !== "active"}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submitText();
                  }
                }}
                placeholder={
                  phase === "transition"
                    ? "下一則工作通知準備中..."
                    : `輸入訊息，按 Enter 送到${channelLabels[selectedChannel]}...`
                }
              />
              <div className="composer-actions">
                <small>
                  {activePulse.type === "debate"
                    ? `已連發 ${fragments.length} 段 · 反擊時可以拆句展現手速`
                    : "這則訊息未必需要文字回覆"}
                </small>
                <div>
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
                    disabled={
                      phase !== "active" ||
                      activePulse.type !== "debate" ||
                      fragments.length === 0
                    }
                    onClick={() => resolveDebate()}
                  >
                    送出這波
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="context-card">
            <p className="panel-label">
              {activePulse.type === "debate" ? "NEEDS A REPLY" : "OFFICE NOISE"} ·{" "}
              {getPulseClock(activePulse)}
            </p>
            <h2>{activePulse.type === "debate" ? activeBeat!.headline : activePulse.headline}</h2>
            <div>
              <span>{activePulse.type === "debate" ? "事件背景" : "訊息判讀"}</span>
              <p>
                {activePulse.type === "debate" ? activeBeat!.situation : activePulse.situation}
              </p>
            </div>
            <div className="weak-point">
              <span>{activePulse.type === "debate" ? "回擊切入點" : "合宜反應"}</span>
              <p>
                {activePulse.type === "debate" ? activeBeat!.weakness : activePulse.guidance}
              </p>
            </div>
            {activePulse.type === "debate" ? (
              <div>
                <span>可用論點</span>
                <ul>
                  {activeBeat!.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <span>可接受操作</span>
                <p>
                  {activePulse.allowRead ? "已讀" : ""}
                  {activePulse.acceptedReactions.length > 0
                    ? ` · ${activePulse.acceptedReactions.join(" ")}`
                    : ""}
                </p>
              </div>
            )}
            <div className="target-channel">
              <span>訊息所在</span>
              <strong>[{channelLabels[activeChannel]}]</strong>
              {activeChannel !== selectedChannel && <small>切換上方分頁查看新訊息</small>}
            </div>
            {lastResult && (
              <div className="last-score">
                <span>上一則判定</span>
                <strong>{formatPoints(lastResult.points)}</strong>
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
