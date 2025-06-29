const express = require('express');
const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');

const app = express();

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// OpenAI設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 会話履歴保存（最大50件）
const sessions = new Map();

// スタジオ情報（画像リスト反映済、全国網羅）
const studioResponses = {
  "札幌": "【札幌店】札幌駅 徒歩5分",
  "仙台": "【仙台店】仙台駅 徒歩7分",
  "新宿": "【新宿店】新宿駅 徒歩5分",
  "池袋": "【池袋店】池袋駅 徒歩6分",
  "渋谷": "【渋谷店】渋谷駅 徒歩5分",
  "上野": "【上野店】上野駅 徒歩3分",
  "秋葉原": "【秋葉原店】秋葉原駅 徒歩4分",
  "立川": "【立川店】立川駅 徒歩4分",
  "町田": "【町田店】町田駅 徒歩5分",
  "横浜": "【横浜店】横浜駅 徒歩4分",
  "川崎": "【川崎店】川崎駅 徒歩3分",
  "千葉": "【千葉店】千葉駅 徒歩6分",
  "津田沼": "【津田沼店】津田沼駅 徒歩5分",
  "西船橋": "【西船橋店】西船橋駅 徒歩4分",
  "大宮": "【大宮店】大宮駅 徒歩6分",
  "名古屋": "【名古屋店】名古屋駅 徒歩5分",
  "金山": "【金山店】金山駅 徒歩3分",
  "栄": "【栄店】栄駅 徒歩4分",
  "名駅前": "【名駅前店】名古屋駅 徒歩3分",
  "京都": "【京都店】京都駅 徒歩4分",
  "梅田": "【梅田店】梅田駅 徒歩6分",
  "難波": "【難波店】難波駅 徒歩3分",
  "天王寺": "【天王寺店】天王寺駅 徒歩5分",
  "神戸": "【神戸店】三宮駅 徒歩5分",
  "広島": "【広島店】広島駅 徒歩6分",
  "小倉": "【小倉店】小倉駅 徒歩4分",
  "福岡": "【福岡エリア】薬院・博多・天神・大橋に複数店舗あり♪ 最寄りのスタジオをご案内します♡",
  "薬院": "【薬院店】薬院駅 徒歩3分",
  "博多": "【博多店】博多駅 徒歩5分",
  "天神": "【天神店】天神駅 徒歩4分",
  "大橋": "【大橋店】大橋駅 徒歩3分",
  "大分": "【大分店】大分駅 徒歩6分",
  "鹿児島": "【鹿児島店】鹿児島中央駅 徒歩5分",
  "佐賀": "【佐賀店】佐賀駅 徒歩6分"
};

// 固定応答設定
const fixedResponses = [
  {
    keywords: ['報酬', '給料', '料率', 'お金', '時給'],
    response: `ご報酬はユーザー様1人あたり1分100円〜の利用料のうち、30%（＝1分あたり30円〜）がご自身の収入になります♡\n体験でも1日15,000〜30,000円ほど稼ぐ方が多く、月に100万円以上の方もいらっしゃいます♪\n完全歩合制で、ご自分のペースで働けるのも魅力ですよ♪`
  },
  {
    keywords: ['仕事内容', '仕事って', '何する'],
    response: `会員制チャットサイトで楽しくお話するだけのお仕事です♡\nノルマなし・顔出しも自由・アダルトも任意だから安心して始められますよ♪`
  }
];

// Webhookルーティング
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).end();
  const events = req.body.events;

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const userMessage = event.message.text.toLowerCase();

      // 地名対応
      const studioKey = Object.keys(studioResponses).find(key => userMessage.includes(key));
      const studioPart = studioKey ? studioResponses[studioKey] : null;

      // 固定応答
      const fixed = fixedResponses.find(f => f.keywords.some(k => userMessage.includes(k)));
      const fixedPart = fixed ? fixed.response : null;

      // 履歴管理
      const history = sessions.get(userId) || [];
      const updatedHistory = [...history, { role: 'user', content: userMessage }];
      sessions.set(userId, updatedHistory.slice(-50));

      // GPTへ履歴送信（直近10件）
      const messages = [
        {
          role: 'system',
          content: `あなたはライブチャット事務局のスタッフで、「東大卒の理系で清楚なギャル」です。\n語尾は「〜ですよぉ♪」「〜かもです♡」「〜してねっ」など安心感と明るさを重視。\n報酬は「30%〜」または「1分30円〜」、顔出しやノルマは任意でOKというスタンスで回答してください。\n自己紹介は「ライバーサポートグループ チャットレディ問い合わせ窓口の東大卒理系のギャル、山田です♡」を含めてね。`
        },
        ...updatedHistory.slice(-10).map(msg => ({ role: msg.role, content: msg.content }))
      ];

      let gptReply = '';
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages
        });
        gptReply = completion.choices[0].message.content.trim();
      } catch {
        gptReply = 'ごめんなさい、AIの返信でエラーが出ちゃいました💦';
      }

      const finalReply = [studioPart, fixedPart, gptReply].filter(Boolean).join('\n\n');
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: finalReply
      });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LINE Bot running on port ${PORT}`);
});
