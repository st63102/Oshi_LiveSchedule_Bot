/*
吉本の各劇場のスケジュールを取得するAPI関連
*/

//グローバル変数
const endpoint = 'https://feed-api.yoshimoto.co.jp/fany/theater/v1' // 劇場APIのエンドポイント

// HTTPリクエストの作成
function fetchSchedule(theater) {

  // クエリパラメータを生成してエンドポイントに付与
  const url = endpoint + createTheaterQuery(theater); 
  const sleepTime = parseInt(PropertiesService.getScriptProperties().getProperty(configOshiLive('SLEEP_TIME')), 10);

  // headerの作成
  const headers = {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language' : 'ja,en-US;q=0.9,en;q=0.8',
    'sec-ch-ua' : '\"Google Chrome\";v=\"117\", \"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"117\"',
    'sec-ch-ua-mobile' : '?0',
    'sec-ch-ua-platform' : '\"Windows\"',
    'sec-fetch-dest' : 'empty',
    'sec-fetch-mode' : 'cors',
    'sec-fetch-site' : 'same-site'
  };

  const options = {
    'headers' : headers,
    'referrer' : theater['url'],
    'referrerPolicy' : 'strict-origin-when-cross-origin',
    'body' : 'null',
    'method' : 'GET',
    'mode' : 'cors',
    'credentials' : 'omit',
    'muteHttpExceptions': true,
    'followRedirects' : false
  };

  // HTTPリクエストの送信
  try {
    // 頻繁なアクセスによる404を回避するため、スリープ挟む
    Utilities.sleep(sleepTime); 
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() == 200) {
      const result = JSON.parse(response.getContentText());
      return result;
    } else {
      throw new Error('異常なレスポンスコード：' + response.getResponseCode());
    }
  } catch (e) {
    console.error('HTTPリクエストエラー：行', e.lineNumber, '、', e.message);
  }
}

// 劇場用クエリパラメータ（?以降の文字列）の作成
function createTheaterQuery(theater) {
  
  let query = '?';

  //劇場の指定
  query = query + 'theater=' + theater['theater'];
  //詳細会場の指定（ドームだけ2つあるから）
  query = query + '&venue=' + theater['venue'];
  //取得日付範囲の指定
  const today = new Date();
  const dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const dateTo = new Date(today.getFullYear(), today.getMonth() + theater['months'], 0);
  //検索開始日付の指定（当月の1日）
  query = query + '&date_from=' + Utilities.formatDate(dateFrom, 'JST', 'yyyyMMdd');
  //検索終了日付の指定（当月+monthヶ月後の月末）
  query = query + '&date_to=' + Utilities.formatDate(dateTo, 'JST', 'yyyyMMdd');

  return query;
}
