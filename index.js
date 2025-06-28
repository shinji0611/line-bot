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

// 会話履歴セッション
const sessions = new Map();

// 固定応答一覧
const fixedResponses = [
  {
    keywords: ['報酬', '給料', '料率', 'お金', '時給'],
    response: '報酬は完全歩合制で1分あたり30円〜っ💰1時間で1800円くらいですよぉ💕 待機中は報酬出ないけど、サイトによっては待機保証もあるから安心してねっ✨'
  },
  {
    keywords: ['勤務地', 'どこで', '通勤', '在宅'],
    response: '勤務地は全国対応で、通勤も在宅もどっちもOKですっ🏠✨ 在宅の方も一度面接に来てもらえると稼ぎやすくなるからおすすめっ♡'
  },
  {
    keywords: ['顔出し', '顔に自信', '顔出したくない'],
    response: '顔出ししてない女性もたくさんいますよぉ😊✨ 顔よりも会話の内容が大事だから、自信持って面接に来てねっ♡'
  },
  {
    keywords: ['辞めたい', 'やめる', '退会'],
    response: 'チャットレディは雇用じゃないから、いつでも自由に辞められますよぉ🌸 出演もぜんぶ自分次第っ♪'
  },
  {
    keywords: ['副業', 'バイト', '掛け持ち'],
    response: '副業も大歓迎ですよぉ✨ 登録者の8割くらいは副業として活躍してるから、安心して始められますっ♡'
  },
  {
    keywords: ['登録', '条件', '必要', '身分証'],
    response: '登録には18歳以上で顔写真付きの身分証が必要ですっ📸 それだけでOKなので気軽にどうぞっ♪'
  },
  {
    keywords: ['仕事内容', '仕事って', '何する'],
    response: '会員制チャットサイトで楽しくお話しするだけのお仕事ですっ💻💕 ノルマもなしで安心だよっ♪'
  },
  {
    keywords: ['ノルマ', '強制', 'やらなきゃ'],
    response: 'ノルマは一切なしっ✨ アダルトも強制じゃないから、自分のペースでお仕事できますよぉ😊'
  },
  {
    keywords: ['面接', 'どこ', '服装', '体験'],
    response: '面接地はプライバシーのため非公開だけど、ご希望地近くで待ち合わせしてスタジオで行いますっ💡服装自由＆レンタル衣装も完備してますよぉ♡'
  },
  {
    keywords: ['待機', '何する', 'ヒマ', '動き'],
    response: '待機中はにこやかに♪姿勢や雰囲気を意識すると「お気に入り登録」につながって報酬アップに直結ですっ📸✨'
  },
  {
    keywords: ['スタッフ', '相談', 'サポート'],
    response: '女性スタッフ常駐で、相談しづらいことも親身に対応✨ 男性スタッフも厳選されたマネージャーだけで安心して相談できますよぉ😊'
  },
  {
    keywords: ['スタイル', '体型', '太ってる'],
    response: 'スタイルに自信なくても全然OKっ💡 マネージャーが魅力を引き出してあなたに合ったスタイルを提案するから安心してねっ♡'
  }
];

// Webhook（LINE署名検証のため body 未加工で受ける）
app.post('/webhook', line.middleware(config), express.json(), async (req, res) => {
  res.status(200).end();

  const events = req.body.events;

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;
      const userId = event.source.userId;

      // 固定応答チェック
      const fixed = fixedResponses.find(f =>
        f.keywords.some(keyword => userMessage.toLowerCase().includes(keyword))
      );

      let reply = '';

      if (fixed) {
        reply = fixed.response;
      } else {
        const history = sessions.get(userId) || [];

        const messages = [
          {
            role: 'system',
            content: `あなたはライブチャット事務局のスタッフで、「東大卒の理系で清楚なギャル」です。
語尾は「〜ですよぉ♪」「〜かもです♡」「〜してねっ」など安心感と明るさを重視。
報酬は「30%〜」または「1分30円〜」、顔出しやノルマは任意でOKというスタンスで回答してください。
常に明るく、優しく、誠実にね♡`
          },
          ...history,
          { role: 'user', content: userMessage }
        ];

        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages
        });

        reply = completion.choices[0].message.content.trim();

        const updatedHistory = [...messages, { role: 'assistant', content: reply }];
        sessions.set(userId, updatedHistory.slice(-10));
      }

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: reply
      });
    }
  }
});

// サーバー起動
app.listen(process.env.PORT || 3000, () => {
  console.log('LINE bot is running with session support...');
});
