/*
アプリのスタート地点
*/

//グローバル変数
let gl_shSchedule; //スプシ記載済みのスケジュールを配列-連想配列で持つ

//シート名やスクリプトプロパティのキーなどを一元管理するスクリプト
function configOshiLive(key) {
  return {
    //【グローバル定数系】
    // 定数
    HOLIDAY_CALENDAR_ID : 'ja.japanese#holiday@group.v.calendar.google.com', //日本の祝日GoogleカレンダーのID
    // シート名系
    SS_SHEET_NAME_THEATER : '劇場リスト', // 劇場一覧が記載されているシート名
    SS_SHEET_NAME_SCHEDULE : 'ライブ一覧', // 劇場出番をまとめるシート名
    SS_SHEET_NAME_GCALENDAR : 'カレンダー削除対象', // カレンダーの予定をまとめて削除するためのシート名
    SS_SHEET_NAME_ARCHIVE : '履歴', // 過去の劇場出番をアーカイブするシート名

    //【スクリプトプロパティ系】
    //ユーザープロパティ
    SS_ID : 'SS_ID', // このプロジェクトがコンテナバインドされたスプシのID
    GC_ID : 'GC_ID', // このアプリから予定を操作したいGoogleカレンダーID
    SLACK_WEBHOOK_URL : 'SLACK_WEBHOOK_URL',  // このアプリから投稿するslackのアプリに対応するURL
    TWITTER_CLIENT_ID : 'TWITTER_CLIENT_ID', // Twitterから発行されるCrient ID
    TWITTER_CLIENT_SEC : 'TWITTER_CLIENT_SEC',  // Twitterから発行されるCrient Sec

    //スクリプトプロパティ
    THEATER_LIST : 'THEATER_LIST', // アクセスの対象とする劇場とURLなどの対応表データ。配列-連想配列。
    KEY_WORDS : 'KEY_WORDS', // 検索キーワード。複数対応。配列。
    POST_FLGS : 'POST_FLGS', // 外部サービスとの連携オンオフ設定。trueなら連携する。連想配列
    MAIN_LIVE_TITLE : 'MAIN_LIVE_TITLE',  // 「本公演系」のライブ名を列挙。カレンダーの予定タイトル加工に使用。配列。
    SLEEP_TIME : 'SLEEP_TIME', // API実行直前の待機時間。ミリ秒（3秒なら3000）。
    SLEEP_TIME_POSTS : 'SLEEP_TIME_POSTS', // 一劇場に2件以上の更新が同時に発生した場合、2件目以降の待機時間。ミリ秒（3秒なら3000）。
    TWITTER_ID : 'TWITTER_ID',  // TwitterユーザID。ここでつけた名前で認証情報管理を行う 
    DAYS_UNTIL_ARCHIVE : 'DAYS_UNTIL_ARCHIVE' // ライブが開催されてからスケジュールをアーカイブするまでの日数。

  } [key]
}

//劇場出番情報をチェックするスクリプト。
function oshiLive() {
  //設定の読み込み

  // スクリプトプロパティに保存されている劇場リストの取得とチェック
  const theaters = JSON.parse(PropertiesService.getScriptProperties().getProperty(configOshiLive('THEATER_LIST')));
  if (!(theaters.length > 0)) { // キーはあるが値が空の場合、エラーとする
    console.error('劇場リストが正常に登録されていません。\n「劇場リスト」シートを修正・確認し、スプレッドシートのメニューから「現在の劇場リストを検索対象に設定」をクリックしてください。');
    return;
  }

  // 検索条件のチェック（拡張検討中）
  const keyWords = JSON.parse(PropertiesService.getScriptProperties().getProperty(configOshiLive('KEY_WORDS')));
  if (!(keyWords.length > 0)) { // キーワードが登録されてなければ、エラーとする
    console.error('検索ワードが正常に登録されていません。');
    return;
  }

  // スプシ記載済みスケジュールを取得し、連想配列を要素に持つ配列に変換してグローバル変数に格納
  gl_shSchedule = readShSchedule();

  // 更新判定フラグ
  let updateCount = 0;
  
  // 各劇場に対して処理を行う
  for (let i = 0; i < theaters.length; i++) {
    // //1つの劇場でエラーが出た場合、次の劇場へスキップする
    try {
      updateCount += checkTheaterSchedule(theaters[i], keyWords);
    } catch (e) {
      let errmsg = '【' + theaters[i].name + '】エラー：' + e.message + e.stack;
      if (e.filename && e.lineNumber) {
        errmsg += '\nファイル：' + e.filename + '、行：' + e.lineNumber;
      }
      console.error(errmsg);
    }
  }
  
  //全劇場チェック後の処理
  if (updateCount > 0) {
    sortSchedule();
    adjustCellsSize_small();    // シートの体裁を一覧用に整える
  }

  console.log(arguments.callee.name, '関数が実行完了しました。');
}

//1劇場のスケジュールを取得し、新規情報があれば通知するスクリプト
function checkTheaterSchedule(theater, keywords) {

  // APIを叩いて結果を受け取る
  const allSchedule = fetchSchedule(theater);

  // 検索条件に合うライブの抽出
  const matchedSchedule = retrieveSchedule(allSchedule, keywords);
  // 検索結果が0件なら以降の処理は必要ないので、次の劇場へスキップ
  if (!(Array.isArray(matchedSchedule) && (matchedSchedule.length > 0))) {
    console.log('【', theater.name, '】現在HPに出演情報は掲載されていません。');
    return 0;
  }

  // 新規公演情報を抽出
  const newSchedule = existsNewSchedule(matchedSchedule);
  // 新規公演情報が0件なら以降の処理は必要ないので、次の劇場へスキップ
  if (!(Array.isArray(newSchedule) && (newSchedule.length > 0))) {
    console.log('【', theater.name, '】新着情報なし');
    return 0;
  }

  console.log('【', theater.name, '】新着ライブが', newSchedule.length, '件あります！');
  console.log(newSchedule);

  // JS用にデータの加工
  const modifiedNewSchedule = modifySchedule(theater, newSchedule);

  //新着ライブの数だけ、外部サービスへのpostを実行し、結果を配列-連想配列に格納する
  let postResults = [];

  for (let i = 0; i < modifiedNewSchedule.length; i++) {
    //console.log(modifiedNewSchedule[i]);  //処理中のレコード
    if (i > 0) {Utilities.sleep(parseInt(PropertiesService.getScriptProperties().getProperty(configOshiLive('SLEEP_TIME_POSTS')), 10));} // 一度に2件以上処理する場合の待機時間
    const postResult = postToServices(theater, modifiedNewSchedule[i]);
    postResults.push(postResult);
  }

  //新規公演情報を、通知状況とともにスプシに記載する
  const updateCount = writeNewSchedule(modifiedNewSchedule, postResults);

  console.log('【', theater.name, '】ライブ情報を', updateCount, '件更新しました！');

  return updateCount;
}

// JSから外部サービスに出力しやすいようデータ加工する
function modifySchedule(theater, newSchedule) {
  //劇場ごとに異なる適用をするかもしれないのでtheaterも引数に
  let modifiedNewSchedule = [];
  for (const newLive of newSchedule) {

    //ここから加工処理
    //金額がnullの可能性あり
    if (newLive['price1'] != null) {
      // 前売・当日料金の「バックスラッシュを全角￥に」「スラッシュを、に」修正
      newLive['price1'] = newLive['price1'].replace(/\\/g, '￥').replace(/\//g, '、');
    }
    if (newLive['price2'] != null) {
      newLive['price2'] = newLive['price2'].replace(/\\/g, '￥').replace(/\//g, '、');
    }

    if (newLive['notice'] != null) {
      //HTMLタグではない<>が解釈されてしまうので、全角文字に変換する
      newLive['notice'] = newLive['notice'].replace(/</g, '＜').replace(/>/g, '＞');
      //お知らせに含まれるHTMLエンティティを修正する
      newLive['notice'] = XmlService.parse('<d>' + newLive['notice'] + '</d>').getRootElement().getText();
    }
    //ここまで加工処理

    modifiedNewSchedule.push(newLive);
  }
  return modifiedNewSchedule;
}

// 新着ライブ情報を外部サービスに投稿し、その結果を連想配列にまとめて返す
function postToServices(theater, newLive) {
  let slackResult = 0;
  let gCalendarResult = 0;
  let twitterResult = 0;
  // 外部サービス連携フラグオフのときはポストを実行しない。
  const postFlgs = JSON.parse(PropertiesService.getScriptProperties().getProperty(configOshiLive('POST_FLGS')));

  //Slackへ通知
  if (postFlgs['slack']) {
    slackResult = notifyToSlackByOshiLive(theater, newLive);
  } else {
    slackResult = 1;
  }

  //googleカレンダーへ登録
  if (postFlgs['gCalendar']) {
    gCalendarResult = registerLiveInCalendar(theater, newLive);
  } else {
    gCalendarResult = 1;
  }

  //Twitter投稿
  if (postFlgs['twitter']) {
    twitterResult = postToTwitterByOshiLive(theater, newLive);
  } else {
    twitterResult = 1;
  }

  //各サービスへの投稿成否を連想配列にまとめて返す
  const postResults = {'slackResult':slackResult, 'gCalendarResult':gCalendarResult, 'twitterResult':twitterResult};
  return postResults;
}

//検索条件に合うライブのみを要素に持つ配列を返すスクリプト
function retrieveSchedule(allSchedule, keywords) {

  // 貸し切り公演などmemberの値がnullの場合があり、includes()が実行されないようにする必要がある
  let matchedSchedule = allSchedule.filter(function (live) {
    return live.member !== null && (keywords.some(function (key) {
      return live.member.includes(key);
    }));
  });

  return matchedSchedule;
}

// スプシから現在登録中の検索キーワードを確認する
function showKeyWords() {
  const ui = SpreadsheetApp.getUi();
  const keyWords_arr = JSON.parse(PropertiesService.getScriptProperties().getProperty(configOshiLive('KEY_WORDS')));
  if (keyWords_arr === null) {
    ui.alert('現在キーワードは登録されていません。\nメニューからキーワードを登録してください。');
  } else if (!(keyWords_arr.length > 0)) {
    ui.alert('検索ワードが正常に登録されていません。\nメニューからキーワードを登録してください。');
  } else {
    let keyWords = keyWords_arr.join('\n');
    ui.alert('登録中のキーワード一覧', keyWords, ui.ButtonSet.OK);
  }
}

//スプシから検索キーワードを登録する
function saveKeyWords() {
  const ui = SpreadsheetApp.getUi();
  const title1 = '検索キーワードの新規登録';
  const prompt1_1 = '登録したい検索キーワードの';
  const prompt1_2 = '番目を入力してください。';
  const prompt1_3 = '\n\n【入力済みキーワード】\n'
  const title2 = '検索キーワードの登録確認';
  const prompt2_1 = '\n\n以上の内容を検索キーワードとして登録しますか？\n確定する場合はOK、さらにキーワードを追加したい場合はいいえをクリックしてください。';
  let newKeyWord_arr = [];

  for (let i = 0; i < 21; i++) {
    // キーワードの入力を受け付ける
    let prompt1 = prompt1_1 + (i + 1) + prompt1_2 + prompt1_3;
    if (i == 0) {
      prompt1 += 'なし'
    } else {
      prompt1 += newKeyWord_arr.join('\n')
    }
    const response1 = ui.prompt(title1, prompt1, ui.ButtonSet.OK_CANCEL);
    if (response1.getSelectedButton() == ui.Button.OK) {
      newKeyWord_arr.push(response1.getResponseText());
      const newKeyWords = newKeyWord_arr.join('\n');
      // 確定して登録orキーワードを追加or登録やめる、のいずれか
      const response2 = ui.alert(title2, newKeyWords + prompt2_1, ui.ButtonSet.YES_NO_CANCEL);
      if (response2 == ui.Button.YES) {
        //スクリプトプロパティに格納する
        const data =  JSON.stringify(newKeyWord_arr);
        console.log(data);
        PropertiesService.getScriptProperties().setProperty(configOshiLive('KEY_WORDS'), JSON.stringify(newKeyWord_arr));
        ui.alert('検索キーワードの登録が完了しました。');
        return; // 登録できたら終了
      } else if (response2 == ui.Button.NO) {
        // キーワード入力に戻る
        continue;
      } else {
        // キャンセルまたはクローズのときは登録自体を中止
        ui.alert('検索キーワードの新規登録を中止しました。');
        return; // キャンセルしたら登録せず終了
      }
    } else {
      ui.alert('検索キーワードの新規登録を中止しました。');
      return; // キャンセルしたら登録せず終了
    }
    throw new Error('例外');
  }
  throw new Error('キーワードが多すぎます。');
}

//スプシから外部サービスへの投稿オンオフを設定する
function savePostFlgs() {
  const ui = SpreadsheetApp.getUi();

  const oldPostFlg = JSON.parse(PropertiesService.getScriptProperties().getProperty(configOshiLive('POST_FLGS')));
  let newPostFlg = JSON.parse(PropertiesService.getScriptProperties().getProperty(configOshiLive('POST_FLGS')));

  const title1 = '外部サービスの連携状況確認';
  const prompt1_1 = '現在、外部サービスの連携状況は以下の通りです。\n\n';
  const prompt1_2_sub = joinObj(oldPostFlg, ' : ', '\n');
  const prompt1_2 = prompt1_2_sub.replace(/true/g, '連携する').replace(/false/g, '連携しない');
  const prompt1_3 = '\n\n外部サービスの連携設定に進みますか？';
  const prompt1 = prompt1_1 + prompt1_2 + prompt1_3;
  const title2 = '外部サービスの連携設定';
  const prompt2 = ' との連携を行いますか？\n連携する場合は「OK」を、\n連携しない場合は「いいえ」をクリックしてください。';
  const prompt3_1 = '以下の内容で外部サービスとの連携設定を確定しますか？\n\n';
  let prompt3_2 = '';
  const prompt3_3 = '\n\n設定を確定する場合は「OK」を、\n設定をやめる場合は「キャンセル」をクリックしてください。';

  // 連携状況確認のアラート
  const response1 = ui.alert(title1, prompt1, ui.ButtonSet.YES_NO);
  if (response1 == ui.Button.YES) {
    // 外部サービスの数だけ設定アラートを表示させ、結果を格納する
    for (const service in newPostFlg) {
      const response2 = ui.alert(title2, '【 ' + service + ' 】' + prompt2, ui.ButtonSet.YES_NO);
      if (response2 == ui.Button.YES) {
        newPostFlg[service] = true; //連携する
      } else if (response2 == ui.Button.NO) {
        newPostFlg[service] = false; //連携しない
      } else {
        ui.alert('外部サービスの連携設定を中止しました。');
        return;
      }
    }
    //全サービスにフラグセットできたら、最終確認
    prompt3_2 = joinObj(newPostFlg, '　：　', '\n').replace(/true/g, '連携する').replace(/false/g, '連携しない');
    prompt3 = prompt3_1 + prompt3_2 + prompt3_3;
    const response3 = ui.alert(title2, prompt3, ui.ButtonSet.OK_CANCEL);
    if (response3 == ui.Button.OK) {
      PropertiesService.getScriptProperties().setProperty(configOshiLive('POST_FLGS'), JSON.stringify(newPostFlg));
      ui.alert(title2, '外部サービスの連携設定が完了しました。', ui.ButtonSet.OK);
      return;
    } else {
      ui.alert('外部サービスの連携設定を中止しました。');
      return;
    }
  } // 連携設定に進まなかった場合はそのまま終了する
  return;
}
