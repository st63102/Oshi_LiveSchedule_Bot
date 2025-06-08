/*
グーグルカレンダーの制御・設定
*/

//常設劇場の新着情報を受取り、自分のGoogleカレンダーに予定を追加するスクリプト。
function registerLiveInCalendar(theater, newLive) {
  //CalendarAppクラスオブジェクトを取得
  const myCalendar = CalendarApp.getCalendarById(PropertiesService.getScriptProperties().getProperty(configOshiLive('GC_ID')));

  //登録情報の準備
  //公演名。どの劇場か区別できないときがあるので、公演名次第では先頭に劇場名も付与する
  const mainLiveTitle = JSON.parse(PropertiesService.getScriptProperties().getProperty(configOshiLive('MAIN_LIVE_TITLE')));
  let title = '';
  if (isIncludes(mainLiveTitle, newLive['name'])) {
    title = theater['name'] + ' ' + newLive['name'];
  } else {
    title = newLive['name'];
  }
  //開演時刻。
  const start = new Date(newLive['date'] + ' ' + newLive['dateTime2']);
  //終演時刻。
  let end;

  if (newLive['dateTime3'] == null) {
    // 終演時刻がnullの場合、60分公演として登録する
    end = new Date(newLive['date'] + ' ' + newLive['dateTime2']);
    end.setMinutes(end.getMinutes() + 60);
  } else {
    end = new Date(newLive['date'] + ' ' + newLive['dateTime3']);
    //開演時刻＞終演時刻ならおそらく本来は24時を跨ぐオールナイトライブなので、終了日時を一日後にずらす処理を追加
    if (start.getTime() > end.getTime()) {
      end.setDate(end.getDate() + 1);
    }
  }
  //console.log(Utilities.formatDate(start, 'JST', 'yyyy-MM-dd HH:mm:ss') + '  ' + Utilities.formatDate(end, 'JST', 'yyyy-MM-dd HH:mm:ss'));

  //詳細情報の作成
  let description = '';
  description += '【開場】' + newLive['dateTime1'] + ' \n【開演】' + newLive['dateTime2'] + '  【終演】' + newLive['dateTime3'] + '\n';
  description += '【出演者】\n' + newLive['member'] + '\n';
  description += '【料金】\n前売：' + newLive['price1'] + ' \n当日：' + newLive['price2'] + '\n';
  description += '【詳細】\n' + newLive['notice'] + '\n';
  if (newLive['url1'] !== null) {
    description += '【チケット情報】\n' + '<a href="' + newLive['url1'] + '">' + newLive['url1'] + '</a>\n';
  }
  if (newLive['url2'] !== null) {
    description += '【オンラインチケット情報】\n' + '<a href="' + newLive['url2'] + '">' + newLive['url2'] + '</a>\n';
  }
  //description += '\n' + 'ID:' + newLive['id'];
  const option = {
    'description': description,
    'location': newLive['venue'],
    //'guests': '',
    //'sendInvites': false,
  }

  //ライブ情報を予定として新規作成
  myCalendar.createEvent(title, start, end, option);
  return Date.now();
}

// スプシから入力した範囲のカレンダーを削除候補としてリストアップする
function listUpLiveInCalendar() {
  const ui = SpreadsheetApp.getUi();
  //作業シートの指定
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const sh = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_GCALENDAR'));

  const title1 = '削除候補となる期間を指定';
  const prompt1_1 = '削除の対象となる期間の初日を指定してください。';
  const prompt1_2 = '\n（実際に削除する予定は後で選択できます。）';
  const prompt1_3 = '\nYYYY/M/D の形式で入力してください。例）2023/5/1';
  const prompt1 = prompt1_1 + prompt1_2 + prompt1_3;
  const prompt2_1 = '削除の対象となる期間の最終日を指定してください。';
  const prompt2 = prompt2_1 + prompt1_2 + prompt1_3;
  const prompt3_1 = '以下の期間を対象に予定をリストアップします。';
  const prompt3_2 = '（次のアラートが出るまで数十秒お待ちください。）';
  const title4 = '削除候補の予定リストアップ完了';
  const prompt4_1 = configOshiLive('SS_SHEET_NAME_GCALENDAR') + 'シートに、対象期間内の予定をリストアップしました。';
  const prompt4_2 = '\n削除したい予定だけがシートに記載されたままになるようシートを調整したら、メニューから「指定した予定を削除」を実行してください。';
  const prompt4_3 = '\n（調整せずに「指定した予定を削除」すると、指定した期間にあるすべての予定が削除されます。）';
  const prompt4 = prompt4_1 + prompt4_2 + prompt4_3;

  // アラート開始
  const response1 = ui.prompt(title1, prompt1, ui.ButtonSet.OK_CANCEL);
  if (response1.getSelectedButton() != ui.Button.OK) {return;}
  const startDate = response1.getResponseText();
  const response2 = ui.prompt(title1, prompt2, ui.ButtonSet.OK_CANCEL);
  if (response2.getSelectedButton() != ui.Button.OK) {return;}
  const endDate = response2.getResponseText();
  const response3 = ui.alert(title1, prompt3_1 + '\n' + startDate + ' ～ ' + endDate, ui.ButtonSet.YES_NO);
  if (response3 != ui.Button.YES) {return;}
  lockSpreadsheet();
  //リストアップする
  getEvents(startDate, endDate);
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(configOshiLive('SS_SHEET_NAME_GCALENDAR')).activate();
  unlockSpreadsheet();
  const response4 = ui.alert(title4, prompt4, ui.ButtonSet.OK);
}

function deleteLiveInCalendar() {
  const ui = SpreadsheetApp.getUi();
  //作業シートの指定
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const sh = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_GCALENDAR'));

  const title1 = '予定の削除';
  const prompt1 = '現在' + configOshiLive('SS_SHEET_NAME_GCALENDAR') + 'シートに記載されている予定を削除します。';
  const prompt2 = configOshiLive('SS_SHEET_NAME_GCALENDAR') + 'シートに記載された予定の削除が完了しました。';
  // アラート開始
  const response1 = ui.alert(title1, prompt1, ui.ButtonSet.OK_CANCEL);
  if (response1 != ui.Button.OK) {return;}
  //削除実行
  deleteSpecifiedEvents();
  ui.alert(title1, prompt2, ui.ButtonSet.OK);
}

// スプレッドシートの操作を受け付けないようにする
function lockSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.toast('処理中...', '', -1); // トーストメッセージを表示
  //spreadsheet.updateMenu('メニュー名', [{name: 'メニュー名', functionName: ''}]); // メニューを無効化
  //spreadsheet.flush(); // 変更を反映
}

// スプレッドシートの操作を再開する
function unlockSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.toast('処理完了', '', 1); // トーストメッセージを非表示
  //spreadsheet.updateMenu('メニュー名', [{name: 'メニュー名', functionName: 'main'}]); // メニューを有効化
  //spreadsheet.flush(); // 変更を反映
}


function getEvents(startdate, endDate) {
  //作業シートの指定
  const myCalendar = CalendarApp.getCalendarById(PropertiesService.getScriptProperties().getProperty(configOshiLive('GC_ID')));
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const sh = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_GCALENDAR'));

  const calendar = myCalendar;
  // const startTime = new Date('2023/10/1'); // 削除候補の開始日
  // const endTime = new Date('2024/1/31 24:00');  // 削除候補の最終日
  const startTime = new Date(startdate); // 削除候補の開始日
  const endTime = new Date(endDate + ' 24:00');  // 削除候補の最終日
  const events = calendar.getEvents(startTime, endTime);
  const sheet = sh;
  sheet.clear();
  sheet.appendRow(['ID', 'Title', 'Description', 'StartTime', 'EndTime', 'Creators', 'Location', 'LastUpdated']);
  events.forEach(event => {
    sheet.appendRow([
      event.getId(),
      event.getTitle(),
      event.getDescription(),
      event.getStartTime(),
      event.getEndTime(),
      event.getCreators().join(','),
      event.getLocation(),
      event.getLastUpdated(),
    ])
  });
}

function deleteSpecifiedEvents() {
  //作業シートの指定
  const myCalendar = CalendarApp.getCalendarById(PropertiesService.getScriptProperties().getProperty(configOshiLive('GC_ID')));
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const sh = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_GCALENDAR'));

  const sheet = sh;
  const records = sheet.getDataRange().getValues().slice(1);
  const startTime = records.reduce((acc, value) => { return !acc || value[3] < acc ? value[3] : acc }, null);
  const endTime = records.reduce((acc, value) => { return !acc || acc < value[4] ? value[4] : acc }, null);
  const calendar = myCalendar;
  const calendarEvents = calendar.getEvents(startTime, endTime);
  records.forEach(record => {
    const event = calendarEvents.find(event => event.getId() === record[0]);
    const title = event.getTitle();
    const start = Utilities.formatDate(event.getStartTime(), 'JST', 'yyyy-MM-dd HH:mm');
    const end = Utilities.formatDate(event.getEndTime(), 'JST', 'yyyy-MM-dd HH:mm');
    Logger.log(`${title} (${start} - ${end})`);
    event.deleteEvent()
  })
}
