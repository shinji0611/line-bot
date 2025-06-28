const express = require('express');
const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(express.json());

app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).end();

  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;

      let fixedPart = '';
      if (userMessage.includes('報酬')) {
        fixedPart = '報酬は完全歩合制で、1分30円〜です♪';
      } else if (userMessage.includes('顔出し')) {
        fixedPart = '顔出しなしでも大丈夫です！安心してね♡';
      }

      let gptReply = '';
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: userMessage }],
        });
        gptReply = completion.choices[0].message.content;
      } catch (error) {
        gptReply = 'ごめんなさい、AIの返信でエラーが出ちゃいました💦';
      }

      const finalReply = fixedPart ? ${fixedPart}\n\n${gptReply} : gptReply;

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: finalReply,
      });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
