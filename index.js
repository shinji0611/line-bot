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

// Webhookエンドポイント
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).end(); // 即レス

  const events = req.body.events;
  for (const event of events) {
    await handleEvent(event);
  }
});

// イベント処理関数
async function handleEvent(event) {
  console.log('受信イベント:', JSON.stringify(event, null, 2));

  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const gptReply = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: event.message.text }]
  });

  const replyText = gptReply.choices[0].message.content;

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
