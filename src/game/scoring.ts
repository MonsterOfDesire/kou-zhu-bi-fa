import {
  RESPONSE_SECONDS,
  hostileEmoji,
  profanityKeywords,
  unsafeLanguageKeywords,
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
  unsafeLanguage: boolean;
  trashTalkPoints: number;
  trashTalkTags: string[];
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

const trashTalkKeywords = [
  "可憐",
  "閉嘴",
  "笑死",
  "老哥",
  "亂丟",
  "忘了",
  "分身術",
  "招人",
  "資遣",
  "雙標",
  "甩鍋",
  "管理不利",
  "賤",
];

const trashTalkImperatives = ["閉嘴", "自己", "先搞清楚", "不要", "別", "找人", "招人"];

const countHits = (reply: string, keywords: string[]) =>
  keywords.filter((keyword) => reply.includes(normalize(keyword))).length;

const calculateTrashTalk = (fragments: ChatFragment[], acceptedEmojiCount: number) => {
  const textFragments = fragments.filter((fragment) => fragment.kind === "text");
  const replies = textFragments.map((fragment) => fragment.text);
  const normalizedReplies = replies.map(normalize).filter(Boolean);
  const combinedReply = normalize(replies.join(""));
  const rhetoricalCount = replies.filter((reply) =>
    /[?？]|為什麼|為啥|憑什麼|是不是|三小|哪招|不用.+嗎|可以.+喔/.test(reply),
  ).length;
  const shortFragmentCount = normalizedReplies.filter((reply) => reply.length <= 8).length;
  const mockeryCount = countHits(combinedReply, trashTalkKeywords);
  const profanityHitCount = countHits(combinedReply, profanityKeywords);
  const imperativeCount = countHits(combinedReply, trashTalkImperatives);
  const directAddressCount = normalizedReplies.filter((reply) => reply.includes("你")).length;
  const repeatedTextCount = normalizedReplies.reduce(
    (count, reply, index) => count + (normalizedReplies.indexOf(reply) < index ? 1 : 0),
    0,
  );
  const emojiBarrageCount = Math.max(0, acceptedEmojiCount - 1);
  const repeatCount = repeatedTextCount + emojiBarrageCount;
  const points = Math.min(
    300,
    Math.min(rhetoricalCount, 4) * 28 +
      Math.min(shortFragmentCount, 5) * 14 +
      Math.min(mockeryCount, 4) * 30 +
      Math.min(profanityHitCount, 2) * 20 +
      Math.min(imperativeCount, 3) * 16 +
      Math.min(directAddressCount, 3) * 14 +
      Math.min(repeatCount, 4) * 15,
  );
  const tags = [
    rhetoricalCount > 0 ? "反問" : null,
    shortFragmentCount >= 2 ? "短句連發" : null,
    mockeryCount > 0 ? "嘲諷" : null,
    imperativeCount > 0 ? "命令句" : null,
    repeatCount > 0 ? "重複節奏" : null,
    profanityHitCount > 0 ? "粗口語氣" : null,
  ].filter((tag): tag is string => Boolean(tag));

  return { points, tags };
};

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
  const unsafeLanguage = unsafeLanguageKeywords.some((keyword) =>
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
  const trashTalk = calculateTrashTalk(relevant, acceptedEmojiCount);
  const characterCount = textReply.length;
  const offTopic =
    characterCount > 0 && matchedConcepts.length === 0 && trashTalk.points < 120;
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
    wrongConversationCount * -45 + (offTopic ? -100 : 0) + (unsafeLanguage ? -260 : 0);
  const rawTotal = Math.max(
    0,
    Math.min(
      maxScore,
      reaction + tempo + substance + concepts + tone + channel + trashTalk.points + penalties,
    ),
  );
  const total = Math.min(
    rawTotal,
    pastedMessageCount > 0 ? Math.round(maxScore * 0.6) : maxScore,
  );
  const correct =
    reachedExpectedConversation &&
    (matchedConcepts.length > 0 || trashTalk.points >= 120) &&
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
            : trashTalk.points >= 120
              ? "未命中題目核心，但嘴砲節奏成立"
              : "沒有打中矛盾核心",
          reachedExpectedConversation ? "聊天室正確" : "聊天室錯誤",
          trashTalk.points > 0
            ? `嘴砲加成 +${trashTalk.points}（${trashTalk.tags.join("、")}）`
            : null,
          hasProfanity ? "粗口在攻防題僅作語氣標記" : null,
          unsafeLanguage ? "威脅或個資式內容扣分" : null,
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
    unsafeLanguage,
    trashTalkPoints: trashTalk.points,
    trashTalkTags: trashTalk.tags,
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
  const unsafeLanguage = unsafeLanguageKeywords.some((keyword) =>
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
    (unsafeLanguage ? -300 : 0) +
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
    !unsafeLanguage &&
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
          hostileEmojiCount > 0 || hasProfanity || unsafeLanguage
            ? "普通聊天不需要開戰"
            : null,
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
    unsafeLanguage,
    trashTalkPoints: 0,
    trashTalkTags: [],
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
