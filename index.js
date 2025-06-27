const express = require('express');
const line = require('@line/bot-sdk');
const { Configuration, OpenAIApi } = require('openai');

const app = express();

// LINE設定
const config = {
  channelAccessToken: 'fHJIgvHg1ZtHgD9RTvmyLvdQb8U9e+06Pj24b4m7YVR8Vn1fepH1kumqyeCRW/hxzAp922h29Fjn/N7ePyEPmJJ2qhFlAf8e/qfXpueecT6X4VuTJPJC6/x4sGujWyIJJHSVbY4tNlLjnhSp621q/AdB04t89/1O/w1cDnyilFU=',
  channelSecret: '27460bb1fba83b4ebe6fd0376a203663'
};
const client = new line.Client(config);

// ChatGPT設定
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY // ← さっき取得したAPIキーをここに貼る
}));

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  const results = await Promise.all(events.map(handleEvent));
  res.json(results);
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // ChatGPTへ送信
  const gptReply = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: event.message.text }]
  });

  const replyText = gptReply.data.choices[0].message.content;

  // LINEに返信
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
