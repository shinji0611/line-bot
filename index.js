const express = require('express');
const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

// セッション保持用（ユーザーごとの会話履歴）
const userSessions = new Map();

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// OpenAI設定（v4）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Webhookエンドポイント
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).end(); // LINEに即レスポンス

  const events = req.body.events;
  for (const event of events) {
    await handleEvent(event);
  }
});

// イベント処理関数
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userId = event.source.userId;

  // セッション履歴の取得 or 初期化
  const history = userSessions.get(userId) || [
    {
      role: 'system',
      content:
        'あなたはセクシーでギャルっぽくて、ノリが良くてちょっと小悪魔なLINEチャットボットです。語尾に「〜だよん💋」「〜なの♡」「マジでヤバくない？」などギャル語を自然に使ってね。'
    }
  ];

  // ユーザーのメッセージ追加
  history.push({ role: 'user', content: event.message.text });

  // ChatGPTに問い合わせ
  const gptReply = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: history
  });

  const replyText = gptReply.choices[0].message.content;

  // 返信を履歴に追加
  history.push({ role: 'assistant', content: replyText });

  // セッション更新
  userSessions.set(userId, history.slice(-10)); // 過去10件だけ保持（メモリ節約）

  // LINEに返信
  await client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText
  });
}

// サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
