import {
  RESPONSE_SECONDS,
  profanityKeywords,
  type AcceptedConcept,
  type DialogueBeat,
  type PlayerChannel,
  type ReplyTier,
} from "../data/officeContent";

export interface ReplyFragment {
  text: string;
  sentAtSeconds: number;
  channel: PlayerChannel;
}

export interface ScoreBreakdown {
  reaction: number;
  tempo: number;
  substance: number;
  concepts: number;
  channel: number;
  penalties: number;
}

export interface RoundScore {
  total: number;
  breakdown: ScoreBreakdown;
  reactionSeconds: number;
  averageGapSeconds: number;
  characterCount: number;
  messageCount: number;
  matchedConcepts: string[];
  expectedChannel: PlayerChannel;
  reachedExpectedChannel: boolean;
  isOffTopic: boolean;
  hasProfanity: boolean;
  isTimeout: boolean;
  scriptReply: string;
}

const normalize = (text: string) =>
  text.toLowerCase().replace(/[\s，。！？、,.!?：:；;「」『』（）()[\]{}]/g, "");

const choose = (options: string[], seed: number) => options[seed % options.length];

const calculateTempo = (fragments: ReplyFragment[]) => {
  if (fragments.length < 2) return { points: 0, averageGapSeconds: 0 };

  const gaps = fragments
    .slice(1)
    .map((fragment, index) => fragment.sentAtSeconds - fragments[index].sentAtSeconds);
  const averageGapSeconds = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const burstPoints = Math.min(90, (fragments.length - 1) * 30);
  const speedPoints =
    averageGapSeconds <= 0.8
      ? 50
      : averageGapSeconds <= 1.5
        ? 30
        : averageGapSeconds <= 2.5
          ? 15
          : 0;

  return { points: burstPoints + speedPoints, averageGapSeconds };
};

const conceptMatches = (reply: string, concept: AcceptedConcept) =>
  concept.aliases.some((alias) => reply.includes(normalize(alias)));

const chooseTier = (score: number): ReplyTier => {
  if (score >= 720) return "excellent";
  if (score >= 420) return "good";
  return "weak";
};

export function scoreReply(
  fragments: ReplyFragment[],
  beat: DialogueBeat,
  endedByTimeout = false,
): RoundScore {
  // No separators: split phrases such as "資 / 遣 / 費" still form one reply.
  const reply = normalize(fragments.map((fragment) => fragment.text.trim()).join(""));
  const characterCount = reply.length;
  const matchedConcepts = beat.concepts
    .filter((concept) => conceptMatches(reply, concept))
    .map((concept) => concept.label);
  const hasProfanity = profanityKeywords.some((keyword) =>
    reply.includes(normalize(keyword)),
  );
  const reachedExpectedChannel = fragments.some(
    (fragment) => fragment.channel === beat.expectedChannel,
  );
  const isTimeout = endedByTimeout && fragments.length === 0;
  const isOffTopic = characterCount > 0 && matchedConcepts.length === 0;
  const reactionSeconds = fragments[0]?.sentAtSeconds ?? RESPONSE_SECONDS;
  const { points: tempo, averageGapSeconds } = calculateTempo(fragments);

  const reaction =
    fragments.length === 0
      ? 0
      : Math.round(
          190 * Math.max(0, (RESPONSE_SECONDS - reactionSeconds) / RESPONSE_SECONDS),
        );
  const substance =
    characterCount === 0
      ? 0
      : Math.min(characterCount, 30) * 5 -
        Math.max(0, characterCount - 52) * 4;
  const concepts = Math.min(matchedConcepts.length, 3) * 150;
  const channel = reachedExpectedChannel ? 100 : fragments.length > 0 ? -140 : 0;
  const penalties = (isOffTopic ? -120 : 0) + (hasProfanity ? -220 : 0);
  const total = Math.max(
    0,
    Math.min(1000, reaction + tempo + substance + concepts + channel + penalties),
  );

  const responseType =
    fragments.length === 0
      ? "silence"
      : !reachedExpectedChannel
        ? "wrongChannel"
        : chooseTier(total);
  const scriptReply = choose(
    beat.responses[responseType],
    beat.id + characterCount + fragments.length,
  );

  return {
    total,
    breakdown: { reaction, tempo, substance, concepts, channel, penalties },
    reactionSeconds,
    averageGapSeconds,
    characterCount,
    messageCount: fragments.length,
    matchedConcepts,
    expectedChannel: beat.expectedChannel,
    reachedExpectedChannel,
    isOffTopic,
    hasProfanity,
    isTimeout,
    scriptReply,
  };
}
