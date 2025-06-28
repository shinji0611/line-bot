const express = require('express');
const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// ChatGPT設定（OpenAI v4対応）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ユーザーからのメッセージに応じて固定で返す内容
const fixedResponses = [
  {
    keywords: ['料率', '報酬', '給料'],
    response: '報酬は30%〜スタートになりますよぉ💰✨ 経験やスタイルでアップするから、モチベも続きやすいんですっ💕 面談で詳しく聞いてねっ♪'
  },
  {
    keywords: ['通勤', '勤務地', 'どこ'],
    response: '基本はリモートでOKですよぉ🏠✨ ご自宅や好きな場所でお仕事できちゃいますっ💕'
  },
  {
    keywords: ['顔出し', '顔出さないと', '顔出す'],
    response: '顔出しはしなくても全然大丈夫ですっ💡 プライバシー守りながら、安心してチャットできますよぉ😊'
  },
  {
    keywords: ['身バレ', 'バレたら'],
    response: '身バレの心配はほとんどないので安心してねっ🫶 プライバシー対策もバッチリなの✨'
  },
  {
    keywords: ['いつから', 'いつ働ける', '始めたい'],
    response: '登録してから数日〜数週間で始められる方が多いですっ💻💕 スケジュールに合わせてサポートするのでご安心を〜っ♪'
  }
];

// Webhookエンドポイント
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).end(); // LINEに即レス

  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;

      // 固定返答があるかチェック
      const fixed = fixedResponses.find(f =>
        f.keywords.some(keyword => userMessage.includes(keyword))
      );

      let reply = '';

      if (fixed) {
        reply = fixed.response;
      } else {
        // GPTで返答
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `あなたはライブチャット事務局のスタッフであり、「東大卒の理系出身で思いやりのある清楚なギャル」です。

口調の特徴：
・語尾に「〜ですよぉ」「〜かもです♡」「〜しちゃいましょ♪」など柔らかく親しみやすいギャル語を使ってください。
・理系らしいしっかりした説明も混ぜつつ、感情も入れた安心感のある口調で対応してください。

絶対守ってほしいルール：
・報酬は「30%〜」と明確に伝えてOKです。
・報酬率を隠すような返答は禁止です。
・代理店の取り分の話は出さなくてOK。
・出演者が不安に感じること（顔出し・身バレ・副業バレ）には安心できる答えを返してください。

常に、明るく・やさしく・安心できる雰囲気でお願いします♡`
            },
            { role: 'user', content: userMessage }
          ]
        });

        reply = completion.choices[0].message.content.trim();
      }

      // LINEに返信
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: reply
      });
    }
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('LINE bot is running...');
});
