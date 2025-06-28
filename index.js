const express = require('express');
const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');
const admin = require('firebase-admin');

// Firebase設定（Renderの環境変数から）
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

// Firestore会話履歴の保存と取得
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

// 固定回答（正確な内容優先）
const fixedResponses = {
  "料率": "報酬についてはサイトや勤務条件によって異なるんですけど、時給保証やインセンティブ制度もあるので、面談でしっかりご説明させていただきますね〜✨",
  "報酬": "報酬は翌日振込や当日手渡しなどもできるので、ライフスタイルに合わせてお選びいただけますよぉ💕",
  "顔出し": "顔出しは完全に任意なので安心してくださいね〜♪ アバターやマスク、映像加工などの対策も充実してます♡",
  "身バレ": "身バレ対策はしっかりしてるので大丈夫ですよぉ〜！ウィッグやメイクチェンジ、非公開設定なども活用できます✨"
};

// キーワード一致で固定回答を返す関数
function checkFixedResponse(message) {
  for (let key in fixedResponses) {
    if (message.toLowerCase().includes(key)) {
      return fixedResponses[key];
    }
  }
  return null;
}

// LINE Webhook
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).end();

  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const userMessage = event.message.text;

      // 固定回答がある場合はそれを返す
      const fixedReply = checkFixedResponse(userMessage);
      if (fixedReply) {
        await client.replyMessage(event.replyToken, { type: 'text', text: fixedReply });
        await saveHistory(userId, 'user', userMessage);
        await saveHistory(userId, 'assistant', fixedReply);
        return;
      }

      // 会話履歴取得 → GPTへ送信
      const history = await getHistory(userId);
      history.push({ role: 'user', content: userMessage });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `
あなたはチャットレディ向けの事務局スタッフであり、「東大卒の理系出身、思いやりのある清楚なギャル」です。
次のようなトーンで回答してください：

・知的で安心感がありながら、柔らかいギャル語（〜ですよぉ、〜かもです♡、安心してくださいね〜♪）を自然に使う
・上品で寄り添うような対応を意識する
・不安にはしっかり寄り添い、優しく背中を押すように対応する

【重要ルール】：
・報酬の料率は出演者に明示しない。50%などの表現は使わない
・顔出しは任意で、マスク・アバター・映像加工が可能
・身バレ対策は万全。プライバシー保護は徹底している
・詳細は面談で個別に説明する旨を丁寧に伝える
            `
          },
          ...history
        ]
      });

      const reply = completion.choices[0].message.content;

      // LINE返信
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: reply
      });

      // 履歴保存
      await saveHistory(userId, 'user', userMessage);
      await saveHistory(userId, 'assistant', reply);
    }
  }
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot is running on port ${PORT}`);
});
