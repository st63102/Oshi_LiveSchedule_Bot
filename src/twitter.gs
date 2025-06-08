/*
*  TwitterAPI、操作関連
*  このファイルのコードについては、以下サイトの情報を参照させていただきました。
*  https://officeforest.org/wp/2023/01/14/google-apps-script%e3%81%8b%e3%82%89twitter-api%e3%82%92oauth2-0%e8%aa%8d%e8%a8%bc%e3%81%a7%e4%bd%bf%e3%81%86/
*/

//認証用の各種変数
var appid = PropertiesService.getScriptProperties().getProperty(configOshiLive('TWITTER_CLIENT_ID'));
var appsecret = PropertiesService.getScriptProperties().getProperty(configOshiLive('TWITTER_CLIENT_SEC'));
var scope = "tweet.write tweet.read users.read offline.access";
var authurl = "https://twitter.com/i/oauth2/authorize";
var tokenurl = "https://api.twitter.com/2/oauth2/token";

//Tweet Endpoint
var endpoint2 = "https://api.twitter.com/2/tweets";
var getpoint = "https://api.twitter.com/2/tweets/search/recent?query="; //ツイートを検索取得する為のエンドポイント

//ツイート用グローバル変数定義
var tweetAcount = 'TWID_' + PropertiesService.getScriptProperties().getProperty(configOshiLive('TWITTER_ID'));

// Twitter用に情報を加工してツイートするスクリプト
function postToTwitterByOshiLive(theater, newLive) {
  const text = createTextForTwitterByOshiLive(theater, newLive);
  //現状リプライする予定がないので指定していない
  try {
    const result = postTweet(text);
    return result.data.id; // 投稿成功時はツイートIDを返す
  } catch(e) {
    // 投稿失敗時、とりあえず0返す
    return 0;
  }
}

// ツイート用の本文を作成して返すスクリプト
function createTextForTwitterByOshiLive(theater, newLive) {
  let text = "";
  //【ツイート要素組み立て】
  //日時
  const header_cnt = 10 + countBite(theater['name']); //絵文字を含んでいるので文字数を別に記録している
  const date = new Date(newLive['date']); 
  const dateJp = Utilities.formatDate(date, 'JST', 'M月d日'); //日付の日本語フォーマット
  const week = getDayJp(date);
  let holiday = '';
  if (isHoliday(date)) {holiday = '・祝';} //祝日用テキスト
  let startTime = new Date(newLive['date']);
  startTime.setHours(parseInt(newLive['dateTime2'].substr(0, 2), 10), parseInt(newLive['dateTime2'].substr(3, 2), 10));
  let endTime = new Date(newLive['date']);
  let endTimeText = '';
  let durationMiSec;
  let durationMin;
  if (newLive['dateTime3']) {
    endTimeText = newLive['dateTime3'];
    endTime.setHours(parseInt(newLive['dateTime3'].substr(0, 2), 10), parseInt(newLive['dateTime3'].substr(3, 2), 10));
    durationMiSec = endTime.getTime() - startTime.getTime();
    durationMin = durationMiSec / (60 * 1000); // 公演時間（分）
  } else { // 終演時間未定の場合
    endTimeText = '未定';
    durationMin = '？';
  }
  // ライブタイトル
  let liveTitle = '';
  if (newLive['name'].includes('　　※')) {
    liveTitle = newLive['name'].substr(0, newLive['name'].indexOf('　　※'));
    liveTitle = liveTitle.trim();
  } else {
    liveTitle = newLive['name'];
  }
  //料金
  let advPrice = newLive['price1'].split(/、/);
  advPrice[0] = advPrice[0].replace(/[^0-9]/g, '') + '円';
  if (advPrice.length > 1) {advPrice[0] += ' 他';} //前売券は2種類目以降省略する
  let samedayPrice = newLive['price2'].split(/、/);
  if (samedayPrice[0]) {
    samedayPrice[0] = samedayPrice[0].replace(/[^0-9]/g, '') + '円';
  } else {
    samedayPrice[0] = '券なし'; // 当日券がない場合がある
  } 
  if (samedayPrice.length > 1) {
    const keyword = 'オンライン'; //オンライン案内ある時だけ記載する
    if (samedayPrice[1].includes(keyword)) {
      samedayPrice[0] += ' | 配信' + samedayPrice[1].replace(/[^0-9]/g, '') + '円';
    } else {
      samedayPrice[0] += ' 他';
    }
  }

  // 本文作成その1
  const header = '🎪新着＠' + theater['name'] + '🎪\n';
  const separatorLine = '\n';
  const dateAndTime = dateJp + '(' + week + holiday + ') ' + newLive['dateTime2']+ '～' + endTimeText + '(' + durationMin + '分公演)\n';
  const title = liveTitle + '\n';
  const price = '前売' + advPrice[0] + ' | 当日' + samedayPrice[0] + '\n';
  const url = '\n' + newLive['url1'];

  // 文字数カウントして、出演者欄の調整
  let wordCount = header_cnt + countBite(separatorLine) + countBite(dateAndTime) + countBite(title) + countBite(price);
  if (newLive['url1']) {wordCount += 24;} // チケへのURLは固定で改行1文字+23文字とカウント
  const member_MaxCount = 276 - wordCount; // 276にしてるのは文字数カウントの不正確さに対する保険
  console.log('現時点文字数：' + wordCount + '、出演者欄最大文字数：' + member_MaxCount + '、出演者文字数：' + countBite(newLive['member']) + '');
  let member = '';
  if (member_MaxCount <= countBite(newLive['member'])) {
    member = newLive['member'].substr(0, Math.trunc(member_MaxCount / 2)); //ほぼ全角なので半分の文字数しか使えない
    member += '…';
  } else {
    member = newLive['member'];
  }

  // 本文作成その2
  text += header;
  text += separatorLine;
  text += dateAndTime;
  text += title;
  text += price;
  text += member;
  if (newLive['url1']) {text += url;} 
  return text;
}

//ツイートする
function postTweet(twText, tweetId) {

  //トークン確認
  var service = checkOAuth();

  if (service.hasAccess()) {
    //message本文
    var message = {
      text: twText
    }
    //リプライの場合はリプライ元のツイートIDを指定する
    if(tweetId){
      message['reply'] = {
        in_reply_to_tweet_id: tweetId
      }
    }
    //リクエスト実行
    const response = UrlFetchApp.fetch(endpoint2, {
      method: "post",
      headers: {
        Authorization: 'Bearer ' + service.getAccessToken()
      },
      muteHttpExceptions: true,
      payload: JSON.stringify(message),
      contentType: "application/json"
    });

    //リクエスト結果を取得する
    const result = JSON.parse(response.getContentText());
    //リクエスト結果を表示
    console.log(JSON.stringify(result, null, 2));
    
    return result;

  } else {
    throw new Error('認証エラー');
  }
}

function startoauth() {
  //UIを取得する
  var ui = SpreadsheetApp.getUi();

  //認証済みかチェックする
  var service = checkOAuth();
  if (!service.hasAccess()) {
    //認証画面を出力
    var output = HtmlService.createHtmlOutputFromFile('template').setHeight(450).setWidth(500).setSandboxMode(HtmlService.SandboxMode.IFRAME);
    ui.showModalDialog(output, 'OAuth2.0認証');
  } else {
    //認証済みなので終了する
    ui.alert("すでに認証済みです。");
  }
}

//アクセストークンURLを含んだHTMLを返す関数
function authpage() {
  var service = checkOAuth();
  var authorizationUrl = service.getAuthorizationUrl();
  console.log(authorizationUrl)
  var html = "<center><b><a href='" + authorizationUrl + "' target='_blank' onclick='closeMe();'>アクセス承認</a></b></center>"
  return html;
}

//認証チェック
function checkOAuth() {
  pkceChallengeVerifier();
  const prop = PropertiesService.getUserProperties();

  return OAuth2.createService(tweetAcount) //ここに設定した文字列を変数名としてスクリプトプロパティに保存・参照してツイートする
    .setAuthorizationBaseUrl(authurl)
    .setTokenUrl(tokenurl + '?code_verifier=' + prop.getProperty("code_verifier"))
    .setClientId(appid)
    .setClientSecret(appsecret)
    .setScope(scope)
    .setCallbackFunction("authCallback") //認証を受けたら受け取る関数を指定する
    .setPropertyStore(PropertiesService.getScriptProperties())  //スクリプトプロパティに保存する
    .setParam("response_type", "code")
    .setParam('code_challenge_method', 'S256')
    .setParam('code_challenge', prop.getProperty("code_challenge"))
    .setTokenHeaders({
      'Authorization': 'Basic ' + Utilities.base64Encode(appid + ':' + appsecret),
      'Content-Type': 'application/x-www-form-urlencoded'
    })
}

//認証コールバック
function authCallback(request) {
  var service = checkOAuth();
  var isAuthorized = service.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput("認証に成功しました。ページを閉じてください。");
  } else {
    return HtmlService.createHtmlOutput("認証に失敗しました。");
  }
}

//ログアウト
function reset() {
  checkOAuth().reset();
  SpreadsheetApp.getUi().alert("ログアウトしました。")
}

function pkceChallengeVerifier() {
  var prop = PropertiesService.getUserProperties();
  if (!prop.getProperty("code_verifier")) {
    var verifier = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    for (var i = 0; i < 128; i++) {
      verifier += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    var sha256Hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, verifier)

    var challenge = Utilities.base64Encode(sha256Hash)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    prop.setProperty("code_verifier", verifier)
    prop.setProperty("code_challenge", challenge)
  }
}
