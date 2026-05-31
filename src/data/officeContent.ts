export const BRIEFING_SECONDS = 10;
export const RESPONSE_SECONDS = 30;

export type ChatChannel = "group" | "private" | "system";
export type PlayerChannel = Exclude<ChatChannel, "system">;
export type ReplyTier = "excellent" | "good" | "weak";
export type ReactionEmoji = "👍" | "🙂" | "🙄" | "😅" | "🙏" | "？";

export interface ScriptMessage {
  author: string;
  channel: ChatChannel;
  text: string;
}

export interface AcceptedConcept {
  label: string;
  aliases: string[];
}

export interface DialogueBeat {
  id: number;
  clock: string;
  headline: string;
  situation: string;
  weakness: string;
  hints: string[];
  concepts: AcceptedConcept[];
  incoming: ScriptMessage[];
  expectedChannel: PlayerChannel;
  responseAuthor: string;
  responses: Record<ReplyTier | "wrongChannel" | "silence", string[]>;
}

export interface TitleTier {
  minScore: number;
  title: string;
  description: string;
}

export interface DebatePulse {
  id: string;
  type: "debate";
  beatId: number;
}

export interface AmbientPulse {
  id: string;
  type: "ambient";
  clock: string;
  author: string;
  channel: PlayerChannel;
  text: string;
  headline: string;
  situation: string;
  guidance: string;
  allowRead: boolean;
  acceptedReactions: ReactionEmoji[];
}

export type OfficePulse = DebatePulse | AmbientPulse;

export const reactionOptions: ReactionEmoji[] = ["👍", "🙂", "🙄", "😅", "🙏", "？"];

export const channelLabels: Record<ChatChannel, string> = {
  group: "專案群組",
  private: "私訊",
  system: "系統",
};

const managerResponses = {
  excellent: ["……好，我把優先順序寫清楚。", "收到。這件事我再重新確認安排。"],
  good: ["好，晚點再確認。", "收到，你先照目前排程走。"],
  weak: ["先把事情處理完再討論。", "你這樣回覆沒有解決問題。"],
  wrongChannel: ["[系統] 對方沒有收到你在另一個對話框裡的回覆。"],
  silence: ["[系統] 你沒有回應。新的工作仍然被塞進排程。"],
};

const coworkerResponses = {
  excellent: ["好，那我自己處理。", "了解，我再回去確認分工。"],
  good: ["行，我再問看看。", "好，那先照原本分工。"],
  weak: ["只是請你幫個忙而已。", "算了，我再找別人。"],
  wrongChannel: ["[系統] 你把私下要說的話丟進群組，整間辦公室都看見了。"],
  silence: ["[系統] 你沒有回應。對方暫時把工作留在你桌上。"],
};

export const scenario = {
  title: "社畜模式 · 一週訊息轟炸",
  description:
    "主管、同事與跨部門窗口會輪流丟出不合理要求。你的目標不是禮貌作文，而是在限時內抓住矛盾、快速連發、守住自己的排程。",
  openingSituation:
    "週一中午，你原本只想安靜吃飯。工作群組卻開始跳出訊息，接下來幾天的雙標、甩鍋、臨時加班與跨部門支援會一路排隊找上門。",
  controls: [
    "點選分頁：切換專案群組與私訊聊天室",
    "一般訊息：在原文下方選擇已讀或合宜表情",
    "不合理要求：輸入文字連發，再按「送出這波」",
  ],
  beats: [
    {
      id: 1,
      clock: "週一 12:03",
      headline: "午休被追資料",
      situation:
        "現在是午休時間。主管早上沒有說明期限，卻臨時要求你在 13:00 前整理資料，等於直接吃掉個人休息時間。",
      weakness: "急件不是問題；沒有事先排程，還把臨時需求包裝成理所當然，才是破口。",
      hints: ["主張午休是休息時間", "提醒需求應提前排程", "用勞動規範與資遣成本收尾"],
      concepts: [
        { label: "午休界線", aliases: ["午休", "休息時間", "中午休息", "吃飯", "不用午休", "不用休息"] },
        { label: "臨時排程", aliases: ["臨時", "早上不講", "提前說", "排程", "急什麼", "現在才說"] },
        { label: "勞動規範", aliases: ["勞基法", "勞工局", "檢舉", "申訴", "違法"] },
        { label: "資遣成本", aliases: ["資遣", "資遣費", "開除", "不爽資遣", "不爽開除"] },
        { label: "停止催促", aliases: ["閉嘴", "乖乖等", "不要吵", "bb什麼", "催什麼"] },
      ],
      incoming: [
        { author: "A主管", channel: "group", text: "下午開會要用的資料呢？中午整理一下，13:00 前丟群組。" },
      ],
      expectedChannel: "group",
      responseAuthor: "A主管",
      responses: managerResponses,
    },
    {
      id: 2,
      clock: "週一 13:24",
      headline: "範例突然不算範例",
      situation:
        "你完全照主管提供的參考檔格式交件。主管卻在群組說不能這樣寫，要求全部重做，彷彿那份範例從來不存在。",
      weakness: "如果範例不能照著用，提供範例的人就應該先說明差異，而不是事後把重工責任推給執行者。",
      hints: ["指出內容與範例一致", "要求明確規格與差異", "把重工成本退回需求端"],
      concepts: [
        { label: "照範例製作", aliases: ["照範例", "參考資料", "一模一樣", "照你給的", "範例檔"] },
        { label: "標準不一致", aliases: ["雙標", "不能這樣寫", "標準", "前後不一", "規則變來變去"] },
        { label: "規格說清楚", aliases: ["規格", "講清楚", "差異", "哪裡不一樣", "先說明"] },
        { label: "拒絕無效重工", aliases: ["重做", "重工", "浪費時間", "白做", "你改"] },
      ],
      incoming: [
        { author: "A主管", channel: "group", text: "這個格式誰叫你照參考檔寫的？不能這樣交，全部重弄。" },
      ],
      expectedChannel: "group",
      responseAuthor: "A主管",
      responses: managerResponses,
    },
    {
      id: 3,
      clock: "週一 14:08",
      headline: "順便幫忙變成常駐工作",
      situation:
        "主管私訊要求你整理行政單位的採購清單。這不在原本職務範圍內，而且你手上的正式工作還沒完成。",
      weakness: "所謂順便幫忙會吃掉既有工作時間。至少應先釐清權責、優先順序與由誰承擔延誤。",
      hints: ["切到私訊分頁回覆主管", "要求釐清職務範圍", "請主管明確決定哪件工作延後"],
      concepts: [
        { label: "職務範圍", aliases: ["職務範圍", "工作範圍", "不是我的工作", "職缺內容", "行政工作"] },
        { label: "權責分工", aliases: ["分工", "權責", "行政單位", "誰負責", "找行政"] },
        { label: "優先順序", aliases: ["優先順序", "先做哪個", "排程", "延後", "哪件先做"] },
        { label: "延誤責任", aliases: ["延誤", "進度", "誰承擔", "不要怪我", "影響期限"] },
      ],
      incoming: [
        { author: "A主管", channel: "private", text: "行政那邊缺人，你順便幫忙整理採購清單，很快。" },
      ],
      expectedChannel: "private",
      responseAuthor: "A主管",
      responses: managerResponses,
    },
    {
      id: 4,
      clock: "週一 15:36",
      headline: "別人的出包變成你的假",
      situation:
        "你已提前送出特休申請。主管卻因為其他單位進度落後，要求你取消請假去支援；落後原因與你無關。",
      weakness: "跨部門出包應處理根因與人力規劃，不應直接拿已安排的個人假期填洞。",
      hints: ["強調請假已提前提出", "指出進度落後是其他單位責任", "要求正式說明駁回依據"],
      concepts: [
        { label: "事前請假", aliases: ["提前請假", "已經申請", "特休", "排好", "早就送出"] },
        { label: "他單位責任", aliases: ["他們的包", "別的單位", "他們落後", "不關我的事", "他們出包"] },
        { label: "人力調度失敗", aliases: ["人力調度", "缺人", "找人支援", "人力規劃", "填洞"] },
        { label: "駁回依據", aliases: ["駁回依據", "正式說明", "理由", "依據", "請用書面"] },
        { label: "勞動權益", aliases: ["特休", "勞基法", "勞工局", "申訴", "違法"] },
      ],
      incoming: [
        { author: "A主管", channel: "private", text: "你下週的假先不要排。隔壁單位進度落後，需要你支援。" },
      ],
      expectedChannel: "private",
      responseAuthor: "A主管",
      responses: managerResponses,
    },
    {
      id: 5,
      clock: "週一 18:12",
      headline: "下班前五分鐘的急件",
      situation:
        "你已準備下班。主管才說客戶下午改了需求，要求今晚完成，卻沒有提加班費、補休或隔日調整。",
      weakness: "需求變更應重新估時。把延誤直接塞進下班後，只是把管理成本轉嫁給員工。",
      hints: ["先問加班費或補休", "要求重新估時與調整期限", "指出需求變更不是免費加班理由"],
      concepts: [
        { label: "下班界線", aliases: ["下班", "晚上", "非上班時間", "明天", "今天做不完"] },
        { label: "加班補償", aliases: ["加班費", "補休", "報加班", "加班", "工時"] },
        { label: "需求變更", aliases: ["改需求", "需求變更", "客戶改", "新增內容", "變更"] },
        { label: "重新估時", aliases: ["估時", "延期限", "調整期限", "排程", "明天交"] },
      ],
      incoming: [
        { author: "A主管", channel: "group", text: "客戶剛改需求。大家今天先別走，晚上處理完再下班。" },
      ],
      expectedChannel: "group",
      responseAuthor: "A主管",
      responses: managerResponses,
    },
    {
      id: 6,
      clock: "週二 09:05",
      headline: "需求模糊但責任精準",
      situation:
        "昨天主管只用一句口頭描述交辦。今天看到結果後，卻問你為什麼沒有先確認，像是完整規格早就存在。",
      weakness: "需求沒有文件、驗收標準與版本紀錄，就不能把認知差異全部算成執行失誤。",
      hints: ["要求書面規格與驗收標準", "指出昨天沒有明確需求", "保留變更紀錄避免甩鍋"],
      concepts: [
        { label: "需求不清", aliases: ["需求不清楚", "沒講清楚", "口頭", "沒規格", "沒有說"] },
        { label: "書面規格", aliases: ["書面", "規格", "文件", "驗收標準", "需求單"] },
        { label: "版本紀錄", aliases: ["紀錄", "版本", "留存", "變更紀錄", "mail"] },
        { label: "拒絕甩鍋", aliases: ["甩鍋", "怪我", "責任", "不要推給我", "誰交代的"] },
      ],
      incoming: [
        { author: "A主管", channel: "group", text: "這不是我要的。你做之前怎麼都不先確認？" },
      ],
      expectedChannel: "group",
      responseAuthor: "A主管",
      responses: managerResponses,
    },
    {
      id: 7,
      clock: "週二 10:40",
      headline: "幫一次就變固定班底",
      situation:
        "同事上週請你代做週報，這週又私訊說你比較熟，要你順便處理。他已經把臨時幫忙當成固定分工。",
      weakness: "協助不是無限續約。重複性的工作應回到原負責人，或正式調整職務分配。",
      hints: ["切到私訊分頁回覆同事", "說明幫忙不是固定分工", "請對方自己處理或正式提調整"],
      concepts: [
        { label: "幫忙不是常態", aliases: ["上次幫忙", "不是每次", "幫一次", "不要當常態", "順便"] },
        { label: "回到原負責人", aliases: ["你自己做", "自己處理", "原本是你的", "你負責", "不是我負責"] },
        { label: "正式調整分工", aliases: ["調整分工", "正式提出", "找主管", "重新分工", "工作分配"] },
        { label: "自己也有進度", aliases: ["我也有工作", "我的進度", "沒空", "排程", "我手上"] },
      ],
      incoming: [
        { author: "B同事", channel: "private", text: "你上週做過了比較熟，這次週報也順便幫我弄一下，很快啦。" },
      ],
      expectedChannel: "private",
      responseAuthor: "B同事",
      responses: coworkerResponses,
    },
    {
      id: 8,
      clock: "週二 14:20",
      headline: "會議塞滿再問進度",
      situation:
        "主管臨時拉你開了兩個小時的會，現在又在群組追問原定下午完成的報告。工作時間沒有增加。",
      weakness: "會議與產出都會吃時間。若兩者衝突，主管應明確決定優先順序，而不是同時催收。",
      hints: ["指出臨時會議佔用時間", "要求決定會議或交付誰優先", "請主管接受調整後期限"],
      concepts: [
        { label: "會議佔時", aliases: ["開會", "會議", "兩小時", "佔用時間", "剛剛在會議"] },
        { label: "排程衝突", aliases: ["衝突", "時間不會變多", "同時做", "分身", "排程"] },
        { label: "決定優先順序", aliases: ["優先順序", "哪個優先", "先做哪個", "二選一", "請決定"] },
        { label: "調整期限", aliases: ["延後", "期限", "晚點交", "明天", "重新排"] },
      ],
      incoming: [
        { author: "A主管", channel: "group", text: "下午那份報告怎麼還沒看到？這個進度有點慢。" },
      ],
      expectedChannel: "group",
      responseAuthor: "A主管",
      responses: managerResponses,
    },
    {
      id: 9,
      clock: "週三 16:10",
      headline: "成果往上收，問題往下丟",
      situation:
        "專案順利的部分被主管說成自己帶得好；出了問題的部分，卻被說成執行細節，要你自行修正。",
      weakness: "如果主管要認領成果，就不能在出問題時把決策責任全部切回基層執行者。",
      hints: ["要求責任與成果一起計算", "拿出決策與版本紀錄", "拒絕只背問題不分成果"],
      concepts: [
        { label: "成果責任對等", aliases: ["成果", "責任", "一起算", "有功", "出事"] },
        { label: "決策紀錄", aliases: ["紀錄", "版本", "mail", "你決定的", "會議紀錄"] },
        { label: "拒絕甩鍋", aliases: ["甩鍋", "只怪我", "推給我", "執行細節", "背鍋"] },
        { label: "主管也要承擔", aliases: ["你也要負責", "主管負責", "誰帶的", "帶專案", "決策責任"] },
      ],
      incoming: [
        { author: "A主管", channel: "group", text: "方向是我帶得沒問題。現在這個錯誤是執行細節，你修一下。" },
      ],
      expectedChannel: "group",
      responseAuthor: "A主管",
      responses: managerResponses,
    },
    {
      id: 10,
      clock: "週五 16:55",
      headline: "週末支援叫做團隊共識",
      situation:
        "週五下班前，主管突然要求大家週末上線支援，並用團隊共識淡化工時與補償問題。",
      weakness: "若是公司要求的工作，就應明確排班並處理加班補償；不能只靠情緒壓力讓人免費待命。",
      hints: ["確認是否正式排班", "追問加班費或補休", "拒絕把免費待命包裝成共識"],
      concepts: [
        { label: "週末界線", aliases: ["週末", "休假", "假日", "下班", "待命"] },
        { label: "正式排班", aliases: ["排班", "正式", "值班", "誰上線", "輪班"] },
        { label: "加班補償", aliases: ["加班費", "補休", "報加班", "工時", "補償"] },
        { label: "拒絕情緒施壓", aliases: ["共識", "免費", "情緒勒索", "義務", "自願"] },
      ],
      incoming: [
        { author: "A主管", channel: "group", text: "週末大家上線支援一下，團隊共識，不用每件事都算那麼細。" },
      ],
      expectedChannel: "group",
      responseAuthor: "A主管",
      responses: managerResponses,
    },
  ] satisfies DialogueBeat[],
};

export const officeStream: OfficePulse[] = [
  { id: "debate-1", type: "debate", beatId: 1 },
  {
    id: "drink-order",
    type: "ambient",
    clock: "週一 12:18",
    author: "C同事",
    channel: "group",
    text: "下午要訂飲料，有要跟的幫我按個表情，我 12:30 一起送單。",
    headline: "飲料外送揪團",
    situation: "同事只是揪團訂飲料。這不是戰場，也沒有必要寫一篇立場聲明。",
    guidance: "已讀即可；要跟團可以用正向或輕鬆表情。",
    allowRead: true,
    acceptedReactions: ["👍", "🙂"],
  },
  { id: "debate-2", type: "debate", beatId: 2 },
  {
    id: "expense-reminder",
    type: "ambient",
    clock: "週一 13:40",
    author: "D行政",
    channel: "group",
    text: "提醒大家：本月報帳單據請在明天下午三點前交給我，謝謝。",
    headline: "行政報帳提醒",
    situation: "行政同仁只是提醒大家交單據。對這種正常通知按白眼或怒氣，會顯得你把脾氣丟錯人。",
    guidance: "已讀、按讚或感謝都合適。",
    allowRead: true,
    acceptedReactions: ["👍", "🙏"],
  },
  { id: "debate-3", type: "debate", beatId: 3 },
  {
    id: "system-maintenance",
    type: "ambient",
    clock: "週一 14:32",
    author: "E資訊部",
    channel: "group",
    text: "ERP 系統將於 17:30 至 18:00 維護，請提前儲存資料，避免作業中斷。",
    headline: "系統停機公告",
    situation: "資訊部預告系統維護。看懂並記住時間即可，不需要在群組額外發揮。",
    guidance: "已讀最穩妥；按讚表示收到也可以。",
    allowRead: true,
    acceptedReactions: ["👍"],
  },
  { id: "debate-4", type: "debate", beatId: 4 },
  {
    id: "delivery-arrived",
    type: "ambient",
    clock: "週一 16:02",
    author: "C同事",
    channel: "group",
    text: "飲料到了，在會議室門口。吸管在右邊紙袋，記得自己拿。",
    headline: "飲料到貨通知",
    situation: "飲料已送達。這是一則生活型通知，快速確認即可。",
    guidance: "已讀或用輕鬆表情回應。",
    allowRead: true,
    acceptedReactions: ["👍", "🙂"],
  },
  { id: "debate-5", type: "debate", beatId: 5 },
  {
    id: "meeting-room",
    type: "ambient",
    clock: "週二 08:52",
    author: "D行政",
    channel: "group",
    text: "十點的大會議室已改到 8F 松山，投影設備剛確認可以正常使用。",
    headline: "會議室異動",
    situation: "行政同仁更新開會地點。重點是不要走錯樓層。",
    guidance: "已讀或按讚表示收到。",
    allowRead: true,
    acceptedReactions: ["👍"],
  },
  { id: "debate-6", type: "debate", beatId: 6 },
  {
    id: "lost-umbrella",
    type: "ambient",
    clock: "週二 09:48",
    author: "B同事",
    channel: "group",
    text: "茶水間有一把黑色折傘，放兩天了。有人知道是誰的嗎？",
    headline: "茶水間失物招領",
    situation: "同事在找雨傘主人。你若不知道答案，安靜已讀就好。",
    guidance: "已讀即可；真的想表示疑惑可以按問號。",
    allowRead: true,
    acceptedReactions: ["？"],
  },
  { id: "debate-7", type: "debate", beatId: 7 },
  {
    id: "birthday-card",
    type: "ambient",
    clock: "週二 11:25",
    author: "C同事",
    channel: "group",
    text: "今天是 D行政生日，卡片放在我桌上，午休前有空可以來簽一下。",
    headline: "生日卡片",
    situation: "同事提醒大家簽生日卡。保持基本社交溫度即可。",
    guidance: "已讀、按讚或微笑都合適。",
    allowRead: true,
    acceptedReactions: ["👍", "🙂"],
  },
  { id: "debate-8", type: "debate", beatId: 8 },
  {
    id: "security-training",
    type: "ambient",
    clock: "週二 15:12",
    author: "F人資",
    channel: "group",
    text: "資安線上課程將於本週五截止，尚未完成的同仁請記得登入平台觀看。",
    headline: "資安課程公告",
    situation: "這是一則例行行政公告。你只需要確認自己是否完成。",
    guidance: "已讀最合適；按讚表示收到也可以。",
    allowRead: true,
    acceptedReactions: ["👍"],
  },
  { id: "debate-9", type: "debate", beatId: 9 },
  {
    id: "aircon-repair",
    type: "ambient",
    clock: "週四 10:08",
    author: "G總務",
    channel: "group",
    text: "冷氣廠商預計 14:00 到場檢修，靠窗座位可能會短暫受到影響。",
    headline: "總務維修通知",
    situation: "總務提前通知環境維修。這則訊息沒有需要爭論的對象。",
    guidance: "已讀即可；按讚表示收到也可以。",
    allowRead: true,
    acceptedReactions: ["👍"],
  },
  { id: "debate-10", type: "debate", beatId: 10 },
];

export const profanityKeywords = [
  "幹",
  "靠北",
  "白癡",
  "智障",
  "媽的",
  "操你",
  "fuck",
  "shit",
];

export const titleTiers: TitleTier[] = [
  {
    minScore: 7600,
    title: "職場界線守門員",
    description: "每一波都抓得到矛盾，訊息發得快，界線也畫得清楚。",
  },
  {
    minScore: 6000,
    title: "群組回覆專員",
    description: "臨時需求壓不住你，排程、權責與補償都記得追問。",
  },
  {
    minScore: 4200,
    title: "拒絕加班練習生",
    description: "已經能守住幾個關鍵點，再把連發節奏磨得更順。",
  },
  {
    minScore: 2400,
    title: "已讀正在輸入",
    description: "有幾句回得漂亮，但偶爾還是被臨時需求帶著走。",
  },
  {
    minScore: 0,
    title: "辦公室已讀不回",
    description: "今天先關通知，明天再和不合理的排程算帳。",
  },
];
