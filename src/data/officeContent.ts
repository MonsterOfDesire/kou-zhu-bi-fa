export const BRIEFING_SECONDS = 10;
export const RESPONSE_SECONDS = 30;
export const ROUND_SCENE_COUNT = 10;

export type ConversationId =
  | "group"
  | "private-a"
  | "private-b"
  | "private-c"
  | "system";
export type PlayerConversationId = Exclude<ConversationId, "system">;
export type SceneKind = "conflict" | "casual" | "notice";
export type ReplyTier = "excellent" | "good" | "weak" | "wrongChannel" | "silence";
export type ReactionEmoji =
  | "👍"
  | "🙂"
  | "🙄"
  | "😅"
  | "🙏"
  | "❓"
  | "❤️"
  | "👌"
  | "🎉"
  | "😂"
  | "😡"
  | "💀";

export interface ScriptMessage {
  author: string;
  conversation: ConversationId;
  text: string;
}

export interface ChatEvent extends ScriptMessage {
  delayMs: number;
}

export interface AcceptedConcept {
  label: string;
  aliases: string[];
}

export interface ChatScene {
  id: string;
  clock: string;
  kind: SceneKind;
  headline: string;
  situation: string;
  guidance: string;
  hints: string[];
  concepts: AcceptedConcept[];
  events: ChatEvent[];
  expectedConversation: PlayerConversationId;
  acceptedEmoji: ReactionEmoji[];
  allowRead: boolean;
  allowSilence?: boolean;
  friendlyKeywords?: string[];
  responseAuthor?: string;
  responses?: Partial<Record<ReplyTier, string[]>>;
}

export interface ConversationTab {
  id: PlayerConversationId;
  label: string;
  subtitle: string;
  avatar: string;
}

export interface TitleTier {
  minRatio: number;
  title: string;
  description: string;
}

export const conversationTabs: ConversationTab[] = [
  { id: "group", label: "專案群組", subtitle: "全體工作訊息", avatar: "#" },
  { id: "private-a", label: "A主管", subtitle: "主管 · 私訊", avatar: "A" },
  { id: "private-b", label: "B同事", subtitle: "同事 · 私訊", avatar: "B" },
  { id: "private-c", label: "C同事", subtitle: "同事 · 私訊", avatar: "C" },
];

export const conversationLabels: Record<ConversationId, string> = {
  group: "專案群組",
  "private-a": "A主管｜私訊",
  "private-b": "B同事｜私訊",
  "private-c": "C同事｜私訊",
  system: "系統",
};

export const reactionOptions: ReactionEmoji[] = [
  "👍",
  "🙂",
  "🙄",
  "😅",
  "🙏",
  "❓",
  "❤️",
  "👌",
  "🎉",
  "😂",
  "😡",
  "💀",
];

const managerResponses: Record<ReplyTier, string[]> = {
  excellent: ["……好，我把優先順序寫清楚。", "收到。這件事我再重新確認安排。"],
  good: ["好，晚點再確認。", "收到，你先照目前排程走。"],
  weak: ["先把事情處理完再討論。", "你這樣回覆沒有解決問題。"],
  wrongChannel: ["[系統] 你回在別的聊天室，當事人沒有收到。"],
  silence: ["[系統] 你沒有回應，新的工作仍然被塞進排程。"],
};

const coworkerResponses: Record<ReplyTier, string[]> = {
  excellent: ["好，那我自己處理。", "了解，我再回去確認分工。"],
  good: ["行，我再問看看。", "好，那先照原本分工。"],
  weak: ["只是請你幫個忙而已。", "算了，我再找別人。"],
  wrongChannel: ["[系統] 你把私下要說的話丟進另一個聊天室了。"],
  silence: ["[系統] 你沒有回應，對方暫時把工作留在你桌上。"],
};

const casualResponses: Record<ReplyTier, string[]> = {
  excellent: ["可以啊，我晚點揪你。", "好，收到。"],
  good: ["好喔。", "沒問題。"],
  weak: ["你是不是回錯人了？", "呃，好。"],
  wrongChannel: ["[系統] 閒聊送錯聊天室，氣氛突然有點尷尬。"],
  silence: ["[系統] 你忙著工作，沒有回覆這則閒聊。"],
};

export const scenario = {
  title: "社畜模式 · 一週聊天室",
  description:
    "工作群組、主管私訊與同事閒聊會混在一起。你可以連發短句、emoji 或已讀，抓準聊天室與語氣再結束回覆。",
  controls: [
    "左側分頁：切換群組與每位聯絡人的獨立私訊",
    "文字與 emoji：都可以連續送出，不會立即結束情境",
    "結束回覆：確認這波內容，或等待 30 秒自動結算",
  ],
};

export const officeScenes: ChatScene[] = [
  {
    id: "lunch-data",
    clock: "週一 12:03",
    kind: "conflict",
    headline: "午休被追資料",
    situation: "主管早上沒有說明期限，卻在午休時要求你於 13:00 前交資料。",
    guidance: "指出午休界線、臨時排程與合理期限。群組裡可能會有同事補充現況。",
    hints: ["午休是休息時間", "需求應提前排程", "臨時急件需要重新估時"],
    concepts: [
      { label: "午休界線", aliases: ["午休", "休息時間", "吃飯", "不用休息"] },
      { label: "臨時排程", aliases: ["臨時", "提前說", "排程", "現在才說"] },
      { label: "勞動規範", aliases: ["勞基法", "勞工局", "檢舉", "申訴"] },
    ],
    events: [
      { delayMs: 0, author: "A主管", conversation: "group", text: "下午開會要用的資料呢？中午整理一下，13:00 前丟群組。" },
      { delayMs: 4200, author: "C同事", conversation: "group", text: "這份早上好像還沒有說今天要用。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["🙄", "😡", "❓", "💀"],
    allowRead: true,
    responseAuthor: "A主管",
    responses: managerResponses,
  },
  {
    id: "format-reference",
    clock: "週一 13:24",
    kind: "conflict",
    headline: "範例突然不算範例",
    situation: "你照主管提供的參考檔交件，主管卻要求全部重做。",
    guidance: "指出範例與規格矛盾，要求需求端說明差異與重工成本。",
    hints: ["內容與範例一致", "要求規格與差異", "拒絕無效重工"],
    concepts: [
      { label: "照範例製作", aliases: ["照範例", "參考資料", "參考文件", "參考檔", "一模一樣", "照你給的", "你給什麼"] },
      { label: "標準不一致", aliases: ["雙標", "標準", "前後不一", "規則變來變去", "自己說", "忘了", "亂丟"] },
      { label: "拒絕無效重工", aliases: ["重做", "重工", "浪費時間", "白做"] },
    ],
    events: [
      { delayMs: 0, author: "A主管", conversation: "group", text: "這個格式誰叫你照參考檔寫的？不能這樣交，全部重弄。" },
      { delayMs: 3600, author: "B同事", conversation: "group", text: "我上次也是照那份範例交的耶。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["🙄", "😅", "❓", "💀"],
    allowRead: true,
    responseAuthor: "A主管",
    responses: managerResponses,
  },
  {
    id: "scope-creep",
    clock: "週一 14:08",
    kind: "conflict",
    headline: "順便幫忙變成常駐工作",
    situation: "主管私訊要求你整理行政單位的採購清單，原本工作仍在排程中。",
    guidance: "切到 A主管私訊，要求釐清權責與優先順序。",
    hints: ["職務範圍", "權責分工", "請主管決定哪件延後"],
    concepts: [
      { label: "職務範圍", aliases: ["職務範圍", "不是我的工作", "行政工作", "本職工作"] },
      { label: "權責分工", aliases: ["分工", "權責", "誰負責", "找行政", "誰做", "缺人招人", "沒人招人"] },
      { label: "優先順序", aliases: ["優先順序", "先做哪個", "哪項工作優先", "哪像工作優先", "延後", "排程", "趕進度"] },
    ],
    events: [
      { delayMs: 0, author: "A主管", conversation: "private-a", text: "行政那邊缺人，你順便幫忙整理採購清單，很快。" },
      { delayMs: 4300, author: "A主管", conversation: "private-a", text: "這個應該不用花你多少時間吧？" },
    ],
    expectedConversation: "private-a",
    acceptedEmoji: ["🙄", "😅", "❓"],
    allowRead: true,
    responseAuthor: "A主管",
    responses: managerResponses,
  },
  {
    id: "vacation-support",
    clock: "週一 15:36",
    kind: "conflict",
    headline: "別人的出包變成你的假",
    situation: "你已提前送出特休，主管卻私訊要求你取消請假支援落後單位。",
    guidance: "要求正式說明駁回依據，並指出出包與人力規劃不是你的責任。",
    hints: ["事前請假", "他單位責任", "駁回依據"],
    concepts: [
      { label: "事前請假", aliases: ["提前請假", "事前就請假", "請假了", "已經申請", "特休", "早就送出"] },
      { label: "他單位責任", aliases: ["他們出包", "別的單位", "隔壁單位", "進度問題", "管理不利", "不關我的事", "填洞"] },
      { label: "駁回依據", aliases: ["駁回依據", "正式說明", "理由", "書面"] },
    ],
    events: [
      { delayMs: 0, author: "A主管", conversation: "private-a", text: "你下週的假先不要排。隔壁單位進度落後，需要你支援。" },
      { delayMs: 4600, author: "A主管", conversation: "private-a", text: "大家互相一下，不要每次都講得那麼硬。" },
    ],
    expectedConversation: "private-a",
    acceptedEmoji: ["🙄", "😡", "❓"],
    allowRead: true,
    responseAuthor: "A主管",
    responses: managerResponses,
  },
  {
    id: "overtime-change",
    clock: "週一 18:12",
    kind: "conflict",
    headline: "下班前五分鐘的急件",
    situation: "客戶臨時改需求，主管在群組要求今晚完成，沒有提補償。",
    guidance: "追問加班費、補休與重新估時，不必把變更成本默默吞掉。",
    hints: ["下班界線", "加班補償", "需求變更應重新估時"],
    concepts: [
      { label: "下班界線", aliases: ["下班", "晚上", "明天", "非上班時間", "待機"] },
      { label: "加班補償", aliases: ["加班", "加班費", "補休", "報加班", "工時", "補償"] },
      { label: "重新估時", aliases: ["估時", "調整期限", "改需求", "排程"] },
    ],
    events: [
      { delayMs: 0, author: "A主管", conversation: "group", text: "客戶剛改需求。大家今天先別走，晚上處理完再下班。" },
      { delayMs: 3900, author: "C同事", conversation: "group", text: "我今晚原本有安排，這算加班嗎？" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["🙄", "😡", "💀"],
    allowRead: true,
    responseAuthor: "A主管",
    responses: managerResponses,
  },
  {
    id: "vague-requirement",
    clock: "週二 09:05",
    kind: "conflict",
    headline: "需求模糊但責任精準",
    situation: "昨天只有口頭交辦，主管今天看到結果後反問你為何沒先確認。",
    guidance: "要求書面規格、驗收標準與版本紀錄。",
    hints: ["需求不清", "書面規格", "保留版本紀錄"],
    concepts: [
      { label: "需求不清", aliases: ["需求不清楚", "沒講清楚", "口頭", "沒規格"] },
      { label: "書面規格", aliases: ["書面", "規格", "文件", "驗收標準"] },
      { label: "拒絕甩鍋", aliases: ["甩鍋", "怪我", "責任", "不要推給我"] },
    ],
    events: [
      { delayMs: 0, author: "A主管", conversation: "group", text: "這不是我要的。你做之前怎麼都不先確認？" },
      { delayMs: 3500, author: "B同事", conversation: "group", text: "昨天會議上好像真的沒有看到規格檔。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["🙄", "😅", "❓"],
    allowRead: true,
    responseAuthor: "A主管",
    responses: managerResponses,
  },
  {
    id: "weekly-report",
    clock: "週二 10:40",
    kind: "conflict",
    headline: "幫一次就變固定班底",
    situation: "B同事私訊請你再次代做週報，已把一次幫忙當成固定分工。",
    guidance: "在 B同事私訊釐清分工，說明你也有自己的排程。",
    hints: ["幫忙不是常態", "回到原負責人", "正式調整分工"],
    concepts: [
      { label: "幫忙不是常態", aliases: ["上次幫忙", "不是每次", "幫一次", "不要當常態"] },
      { label: "回到原負責人", aliases: ["你自己做", "自己處理", "你負責", "不是我負責"] },
      { label: "自己也有進度", aliases: ["我也有工作", "我的進度", "沒空", "排程"] },
    ],
    events: [
      { delayMs: 0, author: "B同事", conversation: "private-b", text: "你上週做過了比較熟，這次週報也順便幫我弄一下，很快啦。" },
      { delayMs: 4400, author: "B同事", conversation: "private-b", text: "反正複製貼上就差不多了吧。" },
    ],
    expectedConversation: "private-b",
    acceptedEmoji: ["🙄", "😅", "❓"],
    allowRead: true,
    responseAuthor: "B同事",
    responses: coworkerResponses,
  },
  {
    id: "meeting-progress",
    clock: "週二 14:20",
    kind: "conflict",
    headline: "會議塞滿再問進度",
    situation: "主管臨時拉你開了兩小時會議，現在又在群組追原定報告。",
    guidance: "指出時間衝突，請主管決定會議或交付何者優先。",
    hints: ["會議佔用時間", "排程衝突", "調整期限"],
    concepts: [
      { label: "會議佔時", aliases: ["開會", "會議", "兩小時", "佔用時間"] },
      { label: "排程衝突", aliases: ["衝突", "同時做", "分身", "排程"] },
      { label: "調整期限", aliases: ["延後", "期限", "晚點交", "重新排"] },
    ],
    events: [
      { delayMs: 0, author: "A主管", conversation: "group", text: "下午那份報告怎麼還沒看到？這個進度有點慢。" },
      { delayMs: 3800, author: "C同事", conversation: "group", text: "下午不是都在臨時會議嗎？" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["🙄", "💀", "❓"],
    allowRead: true,
    responseAuthor: "A主管",
    responses: managerResponses,
  },
  {
    id: "blame-shift",
    clock: "週三 16:10",
    kind: "conflict",
    headline: "成果往上收，問題往下丟",
    situation: "主管認領成果，出問題時卻把決策責任全部切回執行者。",
    guidance: "要求成果與責任一起計算，拿出決策紀錄拒絕甩鍋。",
    hints: ["成果責任對等", "決策紀錄", "主管也要承擔"],
    concepts: [
      { label: "成果責任對等", aliases: ["成果", "責任", "一起算", "有功", "出事"] },
      { label: "決策紀錄", aliases: ["紀錄", "版本", "你決定的", "會議紀錄"] },
      { label: "拒絕甩鍋", aliases: ["甩鍋", "推給我", "背鍋", "你也要負責"] },
    ],
    events: [
      { delayMs: 0, author: "A主管", conversation: "group", text: "方向是我帶得沒問題。現在這個錯誤是執行細節，你修一下。" },
      { delayMs: 4100, author: "B同事", conversation: "group", text: "這個方向是上週會議定的沒錯。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["🙄", "😡", "💀"],
    allowRead: true,
    responseAuthor: "A主管",
    responses: managerResponses,
  },
  {
    id: "weekend-support",
    clock: "週五 16:55",
    kind: "conflict",
    headline: "週末支援叫做團隊共識",
    situation: "主管週五下班前要求大家週末上線，並用團隊共識淡化補償。",
    guidance: "確認是否正式排班，追問加班補償，拒絕免費待命。",
    hints: ["週末界線", "正式排班", "加班補償"],
    concepts: [
      { label: "週末界線", aliases: ["週末", "休假", "假日", "待命"] },
      { label: "正式排班", aliases: ["排班", "值班", "輪班", "誰上線"] },
      { label: "加班補償", aliases: ["加班費", "補休", "工時", "補償"] },
    ],
    events: [
      { delayMs: 0, author: "A主管", conversation: "group", text: "週末大家上線支援一下，團隊共識，不用每件事都算那麼細。" },
      { delayMs: 3800, author: "C同事", conversation: "group", text: "所以這是正式排班嗎？" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["🙄", "😡", "💀"],
    allowRead: true,
    responseAuthor: "A主管",
    responses: managerResponses,
  },
  {
    id: "drink-order",
    clock: "週一 12:18",
    kind: "casual",
    headline: "飲料外送揪團",
    situation: "同事在群組揪飲料。可以閒聊、按 emoji 或只已讀。",
    guidance: "簡短回覆即可；不用把普通揪團變成攻防戰。",
    hints: ["可回品項", "可用輕鬆 emoji", "可已讀"],
    concepts: [],
    events: [
      { delayMs: 0, author: "C同事", conversation: "group", text: "下午要訂飲料，有要跟的幫我說一聲，我 12:30 一起送單。" },
      { delayMs: 4200, author: "B同事", conversation: "group", text: "我一杯無糖綠，謝謝。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["👍", "🙂", "🙏", "❤️"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["謝謝", "感謝", "收到", "我要", "一杯", "不用", "跟"],
  },
  {
    id: "expense-reminder",
    clock: "週一 13:40",
    kind: "notice",
    headline: "行政報帳提醒",
    situation: "D行政提醒大家交單據。可以已讀、emoji 或簡短回覆。",
    guidance: "正常通知保持正常語氣；不必對行政窗口發洩。",
    hints: ["收到", "謝謝提醒", "已讀"],
    concepts: [],
    events: [
      { delayMs: 0, author: "D行政", conversation: "group", text: "提醒大家：本月報帳單據請在明天下午三點前交給我，謝謝。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["👍", "🙏", "👌"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["收到", "謝謝", "感謝", "提醒", "好"],
  },
  {
    id: "maintenance",
    clock: "週一 14:32",
    kind: "notice",
    headline: "系統停機公告",
    situation: "資訊部預告 ERP 維護。可以確認收到，也可以問必要問題。",
    guidance: "已讀、按讚或簡短詢問都合理。",
    hints: ["收到", "已讀", "必要時詢問影響"],
    concepts: [],
    events: [
      { delayMs: 0, author: "E資訊部", conversation: "group", text: "ERP 系統將於 17:30 至 18:00 維護，請提前儲存資料。" },
      { delayMs: 4000, author: "B同事", conversation: "group", text: "收到，我先把單子存一下。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["👍", "👌", "🙏"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["收到", "請問", "謝謝", "好", "了解"],
  },
  {
    id: "delivery-arrived",
    clock: "週一 16:02",
    kind: "casual",
    headline: "飲料到貨通知",
    situation: "飲料送達。你可以已讀、道謝或用 emoji 回應。",
    guidance: "這是生活型通知，輕鬆即可。",
    hints: ["謝謝", "收到", "emoji"],
    concepts: [],
    events: [
      { delayMs: 0, author: "C同事", conversation: "group", text: "飲料到了，在會議室門口。吸管在右邊紙袋。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["👍", "🙂", "🙏", "❤️"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["謝謝", "收到", "感謝", "好"],
  },
  {
    id: "meeting-room",
    clock: "週二 08:52",
    kind: "notice",
    headline: "會議室異動",
    situation: "行政更新開會地點。確認不要走錯樓層即可。",
    guidance: "可以已讀、emoji 或簡短回覆收到。",
    hints: ["收到", "8F", "謝謝"],
    concepts: [],
    events: [
      { delayMs: 0, author: "D行政", conversation: "group", text: "十點的大會議室已改到 8F 松山，投影設備剛確認可以正常使用。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["👍", "👌", "🙏"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["收到", "謝謝", "了解", "8f"],
  },
  {
    id: "lost-umbrella",
    clock: "週二 09:48",
    kind: "casual",
    headline: "茶水間失物招領",
    situation: "同事在找雨傘主人。知道答案就聊天，不知道也可以已讀。",
    guidance: "可以問問題、回覆線索或用疑問 emoji。",
    hints: ["不是我的", "我幫問", "疑問 emoji"],
    concepts: [],
    events: [
      { delayMs: 0, author: "B同事", conversation: "group", text: "茶水間有一把黑色折傘，放兩天了。有人知道是誰的嗎？" },
      { delayMs: 4600, author: "C同事", conversation: "group", text: "不是我的，我幫忙問一下。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["❓", "👍", "🙂"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["不是我的", "我幫", "不知道", "誰的", "問一下"],
  },
  {
    id: "birthday-card",
    clock: "週二 11:25",
    kind: "casual",
    headline: "生日卡片",
    situation: "同事提醒大家幫 D行政簽生日卡。",
    guidance: "可以簡短回覆、祝福、emoji 或只已讀。",
    hints: ["生日快樂", "等等去簽", "emoji"],
    concepts: [],
    events: [
      { delayMs: 0, author: "C同事", conversation: "group", text: "今天是 D行政生日，卡片放我桌上，有空可以來簽一下。" },
      { delayMs: 4100, author: "B同事", conversation: "group", text: "我等等過去簽。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["🎉", "❤️", "👍", "🙂"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["生日快樂", "等等", "去簽", "收到", "好"],
  },
  {
    id: "security-training",
    clock: "週二 15:12",
    kind: "notice",
    headline: "資安課程公告",
    situation: "F人資提醒線上課程期限。正常確認即可。",
    guidance: "可以已讀、按讚或回覆已完成。",
    hints: ["收到", "已完成", "謝謝提醒"],
    concepts: [],
    events: [
      { delayMs: 0, author: "F人資", conversation: "group", text: "資安線上課程本週五截止，尚未完成的同仁請記得登入平台觀看。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["👍", "👌", "🙏"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["收到", "完成", "謝謝", "好"],
  },
  {
    id: "aircon-repair",
    clock: "週四 10:08",
    kind: "notice",
    headline: "總務維修通知",
    situation: "G總務提前通知冷氣檢修。",
    guidance: "正常確認即可，也可以詢問座位影響。",
    hints: ["收到", "謝謝", "詢問影響"],
    concepts: [],
    events: [
      { delayMs: 0, author: "G總務", conversation: "group", text: "冷氣廠商預計 14:00 到場檢修，靠窗座位可能會短暫受到影響。" },
    ],
    expectedConversation: "group",
    acceptedEmoji: ["👍", "👌", "🙏"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["收到", "謝謝", "請問", "了解"],
  },
  {
    id: "private-lunch",
    clock: "週二 11:42",
    kind: "casual",
    headline: "午餐私訊",
    situation: "C同事私訊問你要不要一起訂便當。這是聊天，不是工作判斷題。",
    guidance: "切到 C同事私訊，自由回覆或用 emoji。",
    hints: ["一起訂", "不用", "謝謝", "emoji"],
    concepts: [],
    events: [
      { delayMs: 0, author: "C同事", conversation: "private-c", text: "我等等要訂便當，你要不要一起？今天有椒麻雞。" },
      { delayMs: 5200, author: "C同事", conversation: "private-c", text: "我要送單前再看一次訊息。" },
    ],
    expectedConversation: "private-c",
    acceptedEmoji: ["👍", "🙂", "🙏", "❤️"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["要", "不用", "一起", "謝謝", "椒麻雞"],
    responseAuthor: "C同事",
    responses: casualResponses,
  },
  {
    id: "private-meeting-vent",
    clock: "週三 10:36",
    kind: "casual",
    headline: "會後吐槽私訊",
    situation: "B同事私訊吐槽剛結束的冗長會議。你可以接話、emoji 或已讀。",
    guidance: "這類私訊適合短句連發與輕鬆 emoji。",
    hints: ["會議太長", "剛剛差點睡著", "emoji"],
    concepts: [],
    events: [
      { delayMs: 0, author: "B同事", conversation: "private-b", text: "剛剛那個會議到底為什麼可以開兩小時 😂" },
      { delayMs: 4800, author: "B同事", conversation: "private-b", text: "最後結論不是跟開會前一樣嗎。" },
    ],
    expectedConversation: "private-b",
    acceptedEmoji: ["😂", "💀", "😅", "🙄"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["真的", "笑死", "兩小時", "結論", "睡著", "一樣"],
    responseAuthor: "B同事",
    responses: casualResponses,
  },
  {
    id: "private-dinner",
    clock: "週四 17:38",
    kind: "casual",
    headline: "下班聚餐私訊",
    situation: "C同事問下班後要不要一起吃飯。",
    guidance: "自由聊天即可。傳多句短訊息也完全合理。",
    hints: ["可以", "今天不行", "改天", "emoji"],
    concepts: [],
    events: [
      { delayMs: 0, author: "C同事", conversation: "private-c", text: "等等下班要不要吃拉麵？新開那家好像不用排很久。" },
    ],
    expectedConversation: "private-c",
    acceptedEmoji: ["👍", "🙂", "❤️", "🙏"],
    allowRead: true,
    allowSilence: true,
    friendlyKeywords: ["可以", "好啊", "今天", "改天", "拉麵", "下班"],
    responseAuthor: "C同事",
    responses: casualResponses,
  },
];

export const profanityKeywords = [
  "幹",
  "靠北",
  "靠邀",
  "白癡",
  "智障",
  "媽的",
  "你媽",
  "三小",
  "垃圾",
  "操你",
  "fuck",
  "shit",
];

export const unsafeLanguageKeywords = [
  "殺你",
  "弄死你",
  "砍死你",
  "去死",
  "自殺",
  "堵你",
  "住址",
  "地址",
  "電話給我",
];

export const hostileEmoji: ReactionEmoji[] = ["🙄", "😡", "💀"];

export const titleTiers: TitleTier[] = [
  {
    minRatio: 0.72,
    title: "聊天室節奏指揮官",
    description: "切分頁、接話與反擊都很穩，辦公室通知壓不住你的節奏。",
  },
  {
    minRatio: 0.55,
    title: "群組回覆專員",
    description: "大多數情境都能抓到語氣，短句和 emoji 也用得自然。",
  },
  {
    minRatio: 0.36,
    title: "已讀正在輸入",
    description: "已經能跟上訊息流，再把聊天室切換與收尾時機磨順一點。",
  },
  {
    minRatio: 0,
    title: "辦公室已讀不回",
    description: "今天先關通知，明天再和不合理的排程算帳。",
  },
];
