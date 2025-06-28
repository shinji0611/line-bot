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

// ChatGPT設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 固定返信リスト（ギャル風で用意）
const fixedResponses = [
  {
    keywords: ['料率', '報酬', '給料'],
    response: '報酬は30%〜スタートですよぉ💰✨ 経験やスタイルでどんどんUPするから、やる気もアガるかもですっ💕 面談で詳しく聞いてくださいねっ♪'
  },
  {
    keywords: ['通勤', '勤務地', 'どこ'],
    response: '勤務地は全国にあるし、在宅もOKですよぉ🏠✨ ちなみに在宅の方も面接に一度来ていただくと稼ぎやすくなるのでおすすめですっ♪'
  },
  {
    keywords: ['顔出し', '顔出さないと', '顔出す'],
    response: '顔出ししなくても全然OKですっ💡 プライバシーも大事にしながら、楽しくお仕事できちゃいますよぉ😊💕'
  },
  {
    keywords: ['身バレ', 'バレたら'],
    response: '身バレの心配はほとんどないので安心してねっ🫶 もちろんプライバシー保護もバッチリだから大丈夫だよぉ♡'
  },
  {
    keywords: ['いつから', 'いつ働ける', '始めたい'],
    response: '登録してから数日〜数週間でスタートしてる方が多いですよぉ💻💕 ご希望に合わせて調整するから、いつでも相談してねっ♪'
  },
  {
    keywords: ['支払い', '振込', '手渡し'],
    response: 'お給料は振込が最短翌日で、手渡しも可能ですよぉ💸✨ どっちも対応してるから安心してねっ💕'
  },
  {
    keywords: ['どれくらい稼げる', 'いくら稼げる', '稼げる金額'],
    response: '体験だけでも1日15,000円〜30,000円の方もいますよぉ💖 月に数百万円稼ぐ方もいるので、夢があるお仕事ですっ💻✨'
  },
  {
    keywords: ['送迎', '迎え', '迎えに来て'],
    response: '送迎もあるから通勤も安心ですよぉ🚗💕 気軽に相談してくださいねっ♪'
  },
  {
    keywords: ['時間', '何時から', '24時間'],
    response: '通勤の方は365日24時間いつでも働けるから、ライフスタイルに合わせて自由に働けますよぉ🕒💕'
  }
];

// Webhookエンドポイント（middlewareの順番に注意！）
app.post('/webhook', line.middleware(config), express.json(), async (req, res) => {
  res.status(200).end();

  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;
      let reply = '';

      // 固定返答があるか判定
      const fixed = fixedResponses.find(f =>
        f.keywords.some(keyword => userMessage.includes(keyword))
      );

      if (fixed) {
        reply = fixed.response;
      } else {
        // ChatGPTで返信
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `あなたはライブチャット事務局のスタッフであり、「東大卒の理系出身で思いやりのある清楚なギャル」です。

口調の特徴：
・語尾に「〜ですよぉ」「〜かもです♡」「〜しちゃいましょ♪」など親しみやすいギャル語を使ってください。
・理系らしいしっかりした説明も混ぜつつ、感情も入れた安心感のある口調で対応してください。

絶対守ってほしいルール：
・報酬は「30%〜」と明確に伝えてOKです。
・報酬率を隠すような返答は禁止です。
・代理店の取り分の話は出さないでください。
・出演者が不安に感じること（顔出し・身バレ・副業バレなど）には安心できる答えを返してください。

明るく・やさしく・安心できる雰囲気で、楽しく対応してね♡`
            },
            { role: 'user', content: userMessage }
          ]
        });

        reply = completion.choices[0].message.content.trim();
      }

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: reply
      });
    }
  }
});

// 起動
app.listen(process.env.PORT || 3000, () => {
  console.log('LINE bot is running...');
});
