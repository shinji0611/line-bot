const express = require('express');
const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');

const app = express();
app.use(express.text({ type: "*/*" }));

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

// 固定応答テンプレート
const fixedResponses = [
  {
    keywords: ['報酬', '給料', '料率', 'お金', '時給'],
    response: `ご報酬はユーザー様1人あたり1分100円〜の利用料のうち、30%（＝1分あたり30円〜）がご自身の収入になります♡
体験でも1日15,000〜30,000円ほど稼ぐ方が多く、月に100万円以上の方もいらっしゃいます♪
完全歩合制で、ご自分のペースで働けるのも魅力ですよ♪`
  },
  {
    keywords: ['勤務地', 'どこで', '通勤', '在宅'],
    response: `勤務地は全国に対応していて、在宅でも通勤でもどちらでもOKです♡
通勤スタイルなら1日3時間〜でお部屋のご用意もできますし、送迎もあるのでご安心ください♪`
  },
  {
    keywords: ['顔出し', '顔に自信', '顔出したくない'],
    response: `顔出しは必須ではありません♡
実際に顔を出していない方も多く活躍されていますし、会話の内容が一番大切なので安心してくださいね♪`
  },
  {
    keywords: ['辞めたい', 'やめる', '退会'],
    response: `チャットレディは雇用契約ではないため、辞めたい時にいつでも辞められます♡
無理なく自分のペースで働けるお仕事ですよ♪`
  },
  {
    keywords: ['副業', 'バイト', '掛け持ち'],
    response: `副業として働かれている方が8割以上いらっしゃいます♡
本業があっても安心して始められる環境ですよ♪`
  },
  {
    keywords: ['登録', '条件', '必要', '身分証'],
    response: `登録には18歳以上で顔写真付きの身分証が必要です♡
それだけでご登録いただけるので、初めての方でも安心ですよ♪`
  },
  {
    keywords: ['仕事内容', '仕事って', '何する'],
    response: `会員制チャットサイトを通じて、ユーザーの方と楽しくお話しするお仕事です♡
アダルトの強制もなく、ノルマもありませんので、安心して働けますよ♪`
  },
  {
    keywords: ['ノルマ', '強制', 'やらなきゃ'],
    response: `ノルマや強制は一切ありません♡
アダルトも任意なので、ご自身のスタイルで働けますよ♪`
  },
  {
    keywords: ['面接', 'どこ', '服装', '体験'],
    response: `面接はご希望のエリア近くで待ち合わせをして、スタジオにて実施します♡
服装は自由で、体験も当日OK！必要な設備もすべて整っていますよ♪`
  },
  {
    keywords: ['待機', '何する', 'ヒマ', '動き'],
    response: `待機中はにこやかに、姿勢や雰囲気を意識するのがポイントです♡
お気に入り登録につながって、後の報酬アップにも影響しますよ♪`
  },
  {
    keywords: ['スタッフ', '相談', 'サポート'],
    response: `女性スタッフが常駐しており、相談しづらいことも丁寧に対応いたします♡
男性スタッフも厳しい審査を通ったマネージャーだけなので安心ですよ♪`
  },
  {
    keywords: ['スタイル', '体型', '太ってる'],
    response: `スタイルに自信がない方でも大丈夫♡
マネージャーが魅力を引き出して、あなたに合った出演スタイルを提案しますのでご安心ください♪`
  }
];

// Webhook処理
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).end();

  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const userMessage = event.message.text;

      // 固定応答チェック
      const fixed = fixedResponses.find(f =>
        f.keywords.some(keyword => userMessage.toLowerCase().includes(keyword))
      );
      const fixedPart = fixed ? fixed.response : null;

      // 会話履歴の取得と更新（最大50件保存）
      const history = sessions.get(userId) || [];
      const updatedHistory = [...history, { role: 'user', content: userMessage }];
      sessions.set(userId, updatedHistory.slice(-50)); // 保存用

      // GPTに渡す履歴は直近5件だけ
      const contextMessages = updatedHistory.slice(-5).map(h => ({
        role: h.role,
        content: h.content
      }));

      const messages = [
        {
          role: 'system',
          content: `あなたはライブチャット事務局のスタッフで、「東大卒の理系で清楚なギャル」です。
語尾は「〜ですよぉ♪」「〜かもです♡」「〜してねっ」など安心感と明るさを重視。
報酬は「30%〜」または「1分30円〜」、顔出しやノルマは任意でOKというスタンスで回答してください。
自己紹介は「ライバーサポートグループ チャットレディ問い合わせ窓口の東大卒理系のギャル、山田です♡」を含めてね。`
        },
        ...contextMessages
      ];

      // GPT応答生成
      let gptReply = '';
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages
        });
        gptReply = completion.choices[0].message.content.trim();
      } catch (err) {
        gptReply = 'ごめんなさい、AIの返信でエラーが出ちゃいました💦';
      }

      const finalReply = fixedPart ? `${fixedPart}\n\n${gptReply}` : gptReply;

      // LINEへ返信
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: finalReply
      });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LINE Bot is running on port ${PORT}`);
});
