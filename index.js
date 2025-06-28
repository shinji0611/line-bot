const express = require('express');
const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');
const admin = require('firebase-admin');

// Firebase初期化（環境変数から）
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG_JSON);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// ChatGPT設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
app.use(express.json());

// Firestore会話履歴関数
async function saveHistory(userId, role, message) {
  const ref = db.collection('users').doc(userId);
  await ref.set({
    history: admin.firestore.FieldValue.arrayUnion({ role, content: message })
  }, { merge: true });
}

async function getHistory(userId) {
  const ref = db.collection('users').doc(userId);
  const doc = await ref.get();
  return doc.exists ? doc.data().history : [];
}

// Webhookエンドポイント
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).end();

  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const userMessage = event.message.text;

      // 履歴取得
      const history = await getHistory(userId);

      // 新しい発言を履歴に追加
      history.push({ role: 'user', content: userMessage });

      // ChatGPTに送信
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'あなたはライブチャット事務局のスタッフです。チャットレディの問い合わせに親切・丁寧に答えてください。' },
          ...history
        ]
      });

      const reply = completion.choices[0].message.content;

      // LINE返信
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: reply
      });

      // 履歴を保存
      await saveHistory(userId, 'user', userMessage);
      await saveHistory(userId, 'assistant', reply);
    }
  }
});

// 起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LINE Bot is running on port ${PORT}`);
});
