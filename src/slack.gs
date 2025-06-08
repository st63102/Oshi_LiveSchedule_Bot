/*
slackへの投稿関連
*/

// slackへ通知する用の本文を作成する関数
function createTextForSlackByOshiLive(theater, newLive) {
  // 曜日の準備
  const ary = ['日', '月', '火', '水', '木', '金', '土'];
  const date = new Date(newLive['date']);
  const weekNum = date.getDay();
  const week = '(' + ary[weekNum] + ')';

  let msg = '';
  msg += '【' + theater.name + '】\n'; 
  msg += newLive['date'] + week + ' ' + newLive['dateTime2'] + '～' + newLive['dateTime3'] + '\n';
  msg += newLive['name'] + '\n';
  msg += newLive['member'];

  return msg;
}

//OshiLive用の設定をして、webhookを発火する
function notifyToSlackByOshiLive(theater, newLive) {
  // スクリプトプロパティからチャンネル名を取得
  const channel = PropertiesService.getScriptProperties().getProperty('SLACK_CHANNEL') || '#oshi-live';
  const userName = '推し劇場出番新着';
  const icon = ':推しライブ:';
  const message = createTextForSlackByOshiLive(theater, newLive);

  const result = postToSlack(channel, userName, icon, message);

  if (result.getResponseCode && result.getResponseCode() == 200) {
    return Date.now();
  } else {
    return 0;
  }
}

function postToSlack(channel, userName, icon, message) {
  const jsonData = {
    "channel": channel,
    "username": userName,
    "icon_emoji": icon,
    "text": message
  }
  // 上の送信内容を設定  
  const payload = JSON.stringify(jsonData)

  // オプションを設定
  const options =
  {
    "method": "post",
    "contentType": "application/json",
    "muteHttpExceptions": true,
    "payload": payload
  };

  const slackWebhookURL = PropertiesService.getScriptProperties().getProperty(configOshiLive('SLACK_WEBHOOK_URL'));

  try {
    // リクエスト実行
    const response = UrlFetchApp.fetch(slackWebhookURL, options);
    return response;
  } catch (e) {
    console.error('HTTPリクエストエラー：行', e.lineNumber, '、', e.message);
    console.error(e)
    return 0;
  }
}
