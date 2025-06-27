const express = require('express');
const line = require('@line/bot-sdk');
const app = express();

const config = {
  channelAccessToken: 'fHJIgvHg1ZtHgD9RTvmyLvdQb8U9e+06Pj24b4m7YVR8Vn1fepH1kumqyeCRW/hxzAp922h29Fjn/N7ePyEPmJJ2qhFlAf8e/qfXpueecT6X4VuTJPJC6/x4sGujWyIJJHSVbY4tNlLjnhSp621q/AdB04t89/1O/w1cDnyilFU=',
  channelSecret: '27460bb1fba83b4ebe6fd0376a203663'
};

const client = new line.Client(config);

app.use(express.json());

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text:`あなたは「${event.message.text}」と送りましたね！`
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
