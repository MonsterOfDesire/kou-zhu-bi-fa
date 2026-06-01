import {
  RESPONSE_SECONDS,
  hostileEmoji,
  profanityKeywords,
  type AcceptedConcept,
  type ChatScene,
  type PlayerConversationId,
  type ReactionEmoji,
  type ReplyTier,
} from "../data/officeContent";

export type FragmentKind = "text" | "emoji" | "read";

export interface ChatFragment {
  text: string;
  sentAtSeconds: number;
  conversation: PlayerConversationId;
  kind: FragmentKind;
  pasted?: boolean;
}

export interface SceneScore {
  total: number;
  maxScore: number;
  reactionSeconds: number;
  messageCount: number;
  matchedConcepts: string[];
  reachedExpectedConversation: boolean;
  hasProfanity: boolean;
  pastedMessageCount: number;
  correct: boolean;
  feedback: string;
  scriptReply?: string;
}

const normalize = (text: string) =>
  text.toLowerCase().replace(/[\s，。！？、,.!?：:；;「」『』（）()[\]{}]/g, "");

const choose = (options: string[] | undefined, seed: number) =>
  options && options.length > 0 ? options[seed % options.length] : undefined;

const conceptMatches = (reply: string, concept: AcceptedConcept) =>
  concept.aliases.some((alias) => reply.includes(normalize(alias)));

const calculateTempo = (fragments: ChatFragment[]) => {
  const messages = fragments.filter(
    (fragment) => fragment.kind !== "read" && !fragment.pasted,
  );
  if (messages.length < 2) return 0;

  const gaps = messages
    .slice(1)
    .map((fragment, index) => fragment.sentAtSeconds - messages[index].sentAtSeconds);
  const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const burst = Math.min(100, (messages.length - 1) * 22);
  const speed = averageGap <= 0.9 ? 55 : averageGap <= 1.8 ? 35 : averageGap <= 3 ? 18 : 0;

  return burst + speed;
};

const chooseTier = (ratio: number): ReplyTier => {
  if (ratio >= 0.72) return "excellent";
  if (ratio >= 0.44) return "good";
  return "weak";
};

export const getSceneMaxScore = (scene: ChatScene) =>
  scene.kind === "conflict" ? 1000 : scene.kind === "casual" ? 480 : 360;

const scoreConflict = (
  fragments: ChatFragment[],
  scene: ChatScene,
  endedByTimeout: boolean,
): SceneScore => {
  const maxScore = getSceneMaxScore(scene);
  const relevant = fragments.filter(
    (fragment) => fragment.conversation === scene.expectedConversation,
  );
  const textReply = normalize(
    relevant
      .filter((fragment) => fragment.kind === "text")
      .map((fragment) => fragment.text)
      .join(""),
  );
  const matchedConcepts = scene.concepts
    .filter((concept) => conceptMatches(textReply, concept))
    .map((concept) => concept.label);
  const hasProfanity = profanityKeywords.some((keyword) =>
    textReply.includes(normalize(keyword)),
  );
  const pastedMessageCount = fragments.filter((fragment) => fragment.pasted).length;
  const reactionSeconds =
    fragments.find((fragment) => !fragment.pasted)?.sentAtSeconds ?? RESPONSE_SECONDS;
  const reachedExpectedConversation = relevant.length > 0;
  const wrongConversationCount = fragments.length - relevant.length;
  const acceptedEmojiCount = relevant.filter(
    (fragment) =>
      fragment.kind === "emoji" &&
      scene.acceptedEmoji.includes(fragment.text as ReactionEmoji),
  ).length;
  const characterCount = textReply.length;
  const offTopic = characterCount > 0 && matchedConcepts.length === 0;
  const reaction =
    fragments.length === 0
      ? 0
      : Math.round(175 * Math.max(0, (RESPONSE_SECONDS - reactionSeconds) / RESPONSE_SECONDS));
  const tempo = calculateTempo(relevant);
  const substance = Math.min(characterCount, 42) * 5;
  const concepts = Math.min(matchedConcepts.length, 3) * 155;
  const tone = Math.min(acceptedEmojiCount, 3) * 22;
  const channel = reachedExpectedConversation ? 95 : fragments.length > 0 ? -160 : 0;
  const penalties =
    wrongConversationCount * -45 + (offTopic ? -100 : 0) + (hasProfanity ? -70 : 0);
  const rawTotal = Math.max(
    0,
    Math.min(maxScore, reaction + tempo + substance + concepts + tone + channel + penalties),
  );
  const total = Math.min(
    rawTotal,
    pastedMessageCount > 0 ? Math.round(maxScore * 0.6) : maxScore,
  );
  const correct =
    reachedExpectedConversation &&
    matchedConcepts.length > 0 &&
    total >= Math.round(maxScore * 0.3);
  const responseType: ReplyTier =
    fragments.length === 0
      ? "silence"
      : !reachedExpectedConversation
        ? "wrongChannel"
        : chooseTier(total / maxScore);
  const feedback =
    fragments.length === 0
      ? endedByTimeout
        ? "時間到，這波沒有送出任何回應"
        : "你選擇不回應這個不合理要求"
      : [
          matchedConcepts.length > 0
            ? `命中：${matchedConcepts.join("、")}`
            : "沒有打中矛盾核心",
          reachedExpectedConversation ? "聊天室正確" : "聊天室錯誤",
          hasProfanity ? "語氣過重略扣分" : null,
          pastedMessageCount > 0 ? "貼上內容不計手速，得分上限 60%" : null,
        ]
          .filter(Boolean)
          .join("｜");

  return {
    total,
    maxScore,
    reactionSeconds,
    messageCount: fragments.length,
    matchedConcepts,
    reachedExpectedConversation,
    hasProfanity,
    pastedMessageCount,
    correct,
    feedback,
    scriptReply: choose(scene.responses?.[responseType], scene.id.length + characterCount),
  };
};

const scoreConversation = (
  fragments: ChatFragment[],
  scene: ChatScene,
  endedByTimeout: boolean,
): SceneScore => {
  const maxScore = getSceneMaxScore(scene);
  const relevant = fragments.filter(
    (fragment) => fragment.conversation === scene.expectedConversation,
  );
  const textReply = normalize(
    relevant
      .filter((fragment) => fragment.kind === "text")
      .map((fragment) => fragment.text)
      .join(""),
  );
  const emojiReplies = relevant.filter((fragment) => fragment.kind === "emoji");
  const acceptedEmojiCount = emojiReplies.filter((fragment) =>
    scene.acceptedEmoji.includes(fragment.text as ReactionEmoji),
  ).length;
  const hostileEmojiCount = emojiReplies.filter((fragment) =>
    hostileEmoji.includes(fragment.text as ReactionEmoji),
  ).length;
  const readCount = relevant.filter((fragment) => fragment.kind === "read").length;
  const friendlyHit = (scene.friendlyKeywords ?? []).some((keyword) =>
    textReply.includes(normalize(keyword)),
  );
  const hasProfanity = profanityKeywords.some((keyword) =>
    textReply.includes(normalize(keyword)),
  );
  const pastedMessageCount = fragments.filter((fragment) => fragment.pasted).length;
  const reachedExpectedConversation = relevant.length > 0;
  const reactionSeconds =
    fragments.find((fragment) => !fragment.pasted)?.sentAtSeconds ?? RESPONSE_SECONDS;
  const wrongConversationCount = fragments.length - relevant.length;
  const reaction =
    fragments.length === 0
      ? scene.allowSilence
        ? 80
        : 0
      : Math.round(95 * Math.max(0, (RESPONSE_SECONDS - reactionSeconds) / RESPONSE_SECONDS));
  const read = scene.allowRead && readCount > 0 ? 95 : 0;
  const emoji = Math.min(acceptedEmojiCount, 3) * 48;
  const text =
    textReply.length === 0
      ? 0
      : scene.kind === "casual"
        ? 75 + Math.min(textReply.length, 24) * 4 + (friendlyHit ? 45 : 0)
        : 50 + Math.min(textReply.length, 14) * 3 + (friendlyHit ? 40 : 0);
  const tempo = Math.min(70, calculateTempo(relevant));
  const overReplyLimit = scene.kind === "notice" ? 3 : 6;
  const penalties =
    wrongConversationCount * -55 +
    hostileEmojiCount * -75 +
    (hasProfanity ? -190 : 0) +
    Math.max(0, relevant.length - overReplyLimit) * -28;
  const rawTotal = Math.max(
    0,
    Math.min(maxScore, reaction + read + emoji + text + tempo + penalties),
  );
  const total = Math.min(
    rawTotal,
    pastedMessageCount > 0 ? Math.round(maxScore * 0.6) : maxScore,
  );
  const correct =
    (reachedExpectedConversation || (fragments.length === 0 && Boolean(scene.allowSilence))) &&
    !hasProfanity &&
    hostileEmojiCount === 0 &&
    wrongConversationCount === 0;
  const responseType: ReplyTier =
    fragments.length === 0
      ? "silence"
      : !reachedExpectedConversation
        ? "wrongChannel"
        : chooseTier(total / maxScore);
  const feedback =
    fragments.length === 0
      ? endedByTimeout
        ? scene.allowSilence
          ? "時間到，這則保持安靜也算合理"
          : "時間到，沒有做出回應"
        : "你選擇不回覆"
      : [
          reachedExpectedConversation ? "聊天室正確" : "聊天室錯誤",
          acceptedEmojiCount > 0 ? `合宜 emoji × ${acceptedEmojiCount}` : null,
          friendlyHit ? "文字語氣自然" : textReply.length > 0 ? "已記錄文字回覆" : null,
          hostileEmojiCount > 0 || hasProfanity ? "普通聊天不需要開戰" : null,
          pastedMessageCount > 0 ? "貼上內容不計手速，得分上限 60%" : null,
        ]
          .filter(Boolean)
          .join("｜");

  return {
    total,
    maxScore,
    reactionSeconds,
    messageCount: fragments.length,
    matchedConcepts: [],
    reachedExpectedConversation,
    hasProfanity,
    pastedMessageCount,
    correct,
    feedback,
    scriptReply:
      fragments.length > 0
        ? choose(scene.responses?.[responseType], scene.id.length + textReply.length)
        : undefined,
  };
};

export function scoreScene(
  fragments: ChatFragment[],
  scene: ChatScene,
  endedByTimeout = false,
): SceneScore {
  return scene.kind === "conflict"
    ? scoreConflict(fragments, scene, endedByTimeout)
    : scoreConversation(fragments, scene, endedByTimeout);
}
