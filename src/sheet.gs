/*
スプレッドシートを開いた時の挙動や、
スプレッドシートのデータに関すること
*/

//スプシの劇場リストをスクリプトプロパティに反映するスクリプト。
function readTheaters() {
  
  //作業シートの指定
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const sh = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_THEATER'));

  const theaterTable = sh.getDataRange().getValues(); //　劇場テーブルを2次元配列で取得
  const header = theaterTable[0]; //　劇場リスト1行目の見出しを1次元配列で取得
  
  console.log('見出し列数：', header.length);

  //見出しをキーとした連想配列で構成される配列を作成する
  let theaters = []; // 空の配列を用意

  for (let i = 1; i < theaterTable.length; i++) { //　見出し行は不要なのでカウンタ1開始
    let dict = {}; //空の連想配列を用意
    for (let j = 0; j < header.length; j++) {
      dict[header[j]] = theaterTable[i][j]; //　見出しをキーとした値を一つ追加
    }
    theaters.push(dict); // 1劇場分の連想配列を要素として追加
  }

  console.log('スクリプトプロパティに設定した劇場数：', theaters.length); // 行数と一致するか確認

  //スクリプトプロパティに劇場データを出力する
  const sp = PropertiesService.getScriptProperties();
  sp.setProperty(configOshiLive('THEATER_LIST'), JSON.stringify(theaters));

  //出力したスクリプトプロパティの確認
  const data = JSON.parse(sp.getProperty(configOshiLive('THEATER_LIST')));
  console.log('スクリプトプロパティの詳細：\n', data);
  console.log('スクリプトプロパティから取り出せた劇場数：', data.length);

  //スプレッドシートから実行時に、実行完了を確認する
  Browser.msgBox('readTheaters()の実行','現在の劇場リストを検索対象に設定しました！', Browser.Buttons.OK);
}

// スプシに記録されたスケジュールを取得し、連想配列を要素に持つ配列に変換して返す
function readShSchedule() {
  //作業シートの指定
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const sh = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_SCHEDULE'));

  //記載スケジュールを取得
  const shScheduleTable = sh.getDataRange().getValues();
  const header = shScheduleTable[0]; //　シート1行目の見出しを1次元配列で取得

  //記載スケジュールを2次元配列から連想配列で構成される配列に変換
  let shSchedule = []; // 空の配列を用意
  for (let i = 1; i < shScheduleTable.length; i++) { //　見出し行は不要なのでカウンタ1開始
    let dict = {}; //空の連想配列を用意
    for (let j = 0; j < header.length; j++) {
      dict[header[j]] = shScheduleTable[i][j]; //　見出しをキーとした値を一つ追加
    }
    shSchedule.push(dict); // 1劇場分の連想配列を要素として追加
  }

  console.log('スプレッドシート記載済みデータ：', shSchedule.length, '件');
  return shSchedule;
}

//　引数のスケジュールとスプシに記録されたスケジュールを比較し、未記載のスケジュールのみを抽出する
function existsNewSchedule(matchedSchedule) {

  let newSchedule = []; // 戻り値を格納する空の配列

  if (gl_shSchedule.length >= 1) {
    let flag = false;
    //引数スケジュール内のidの値が、記載スケジュール内のidの値としてヒットしない場合、その連想配列を戻り値用の配列に追加
    for (const matchedLive of matchedSchedule) {
      flag = false; //検索にヒットしたかどうか
      for (const shLive of gl_shSchedule) {
        if (shLive.id == matchedLive.id) {
          flag = true;
          break;
        }
      }
      if (flag == false) { // ヒットなし＝新規ライブとして配列に追加する
        newSchedule.push(matchedLive);
      }
    }
    return newSchedule;
  } else {   // スプシに1件もライブが記載されてない＝全件新着の場合、比較せず全件をそのまま返す
    return matchedSchedule;
  }
}

// 新着ライブ情報を、外部サービスへの投稿フラグとともにスプシに書き込む
function writeNewSchedule(newSchedule, postResults) {
  
  //ライブデータと投稿フラグの連想配列を結合する
  let writingSchedule_dict = [];
  for (let i = 0; i < newSchedule.length; i++) {
    writingSchedule_dict.push({...newSchedule[i], ...postResults[i]});
  }

  //作業シートの指定
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const sh = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_SCHEDULE'));
  
  const lastRow = sh.getLastRow(); //最終行取得
  const lastColumn = sh.getLastColumn(); //最終列取得
  const header = sh.getRange(1,1,1,lastColumn).getValues().flat(); //見出しを取得して1次元配列に

  //一回で書き込むために、連想配列をスプシ通りの配列に変換する
  let writingSchedule_array = [];
  for (let i = 0; i < writingSchedule_dict.length; i++) {
    let writingLive = [];
    for (let j = 0; j < header.length; j++) {
      writingLive[j] = writingSchedule_dict[i][header[j]];
    }
    writingSchedule_array.push(writingLive);
  }

  //スプシへの書き込み
  sh.getRange(lastRow + 1, 1, writingSchedule_array.length, header.length).setValues(writingSchedule_array);
  return writingSchedule_array.length;
}


// 過去のスケジュールをアーカイブ用シートに移動するスクリプト。
function archiveSchedule() {
  // スクリプトプロパティからアーカイブ猶予日数を取得
  const daysUntilArchive = Number(PropertiesService.getScriptProperties().getProperty('DAYS_UNTIL_ARCHIVE'));
  if (isNaN(daysUntilArchive)) {
    Logger.log('DAYS_UNTIL_ARCHIVEが未設定、または数値でありません');
    SpreadsheetApp.getUi().alert('DAYS_UNTIL_ARCHIVEが未設定、または数値でありません');
    return;
  }

  // シート取得
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const scheduleSheet = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_SCHEDULE'));
  const archiveSheetName = configOshiLive('SS_SHEET_NAME_ARCHIVE'); // シート名はスクリプトプロパティ経由
  let archiveSheet = ss.getSheetByName(archiveSheetName);
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(archiveSheetName);
  }

  // データ取得
  const lastRow = scheduleSheet.getLastRow();
  const lastCol = scheduleSheet.getLastColumn();
  if (lastRow < 2) {
    Logger.log('データ行がありません');
    SpreadsheetApp.getUi().alert('アーカイブ対象データがありません');
    return;
  }
  const allData = scheduleSheet.getRange(1, 1, lastRow, lastCol).getValues();
  const header = allData[0];
  const dataRows = allData.slice(1);

  // date列のインデックス取得
  const dateIdx = header.indexOf('date');
  if (dateIdx === -1) {
    Logger.log('date列が見つかりません');
    SpreadsheetApp.getUi().alert('date列が見つかりません');
    return;
  }

  // アーカイブ基準日を計算
  const today = new Date();
  today.setHours(0,0,0,0);
  const archiveLimit = new Date(today.getTime() - daysUntilArchive * 24 * 60 * 60 * 1000);

  // アーカイブ対象・残すデータを分別
  let archiveRows = [];
  let remainRows = [];
  for (let i = 0; i < dataRows.length; i++) {
    let row = dataRows[i];
    let dateCell = row[dateIdx];
    let rowDate = (dateCell instanceof Date) ? dateCell : new Date(dateCell);
    if (isNaN(rowDate.getTime())) {
      remainRows.push(row); // 日付不明は残す
      continue;
    }
    rowDate.setHours(0,0,0,0);
    if (rowDate <= archiveLimit) {
      archiveRows.push(row);
    } else {
      remainRows.push(row);
    }
  }

  // 履歴シートのヘッダーを揃える
  if (archiveSheet.getLastRow() === 0) {
    archiveSheet.appendRow(header);
  } else {
    const archiveHeader = archiveSheet.getRange(1,1,1,archiveSheet.getLastColumn()).getValues()[0];
    if (archiveHeader.join() !== header.join()) {
      archiveSheet.getRange(1,1,1,header.length).setValues([header]);
    }
  }

  // 履歴シートの既存データ件数を取得
  const archiveLastRow = archiveSheet.getLastRow();

  // アーカイブデータを追記
  if (archiveRows.length > 0) {
    archiveSheet.getRange(archiveLastRow+1, 1, archiveRows.length, header.length).setValues(archiveRows);
  }

  // 残すデータでシートを上書き（空行を詰める）
  scheduleSheet.clearContents();
  scheduleSheet.getRange(1,1,1,header.length).setValues([header]);
  if (remainRows.length > 0) {
    scheduleSheet.getRange(2,1,remainRows.length,header.length).setValues(remainRows);
  }

  // 完了メッセージ
  Logger.log('アーカイブ完了: ' + archiveRows.length + '件');
  SpreadsheetApp.getUi().alert('アーカイブ完了: ' + archiveRows.length + '件');
}


// 
function sortSchedule() {
  //作業シートの指定
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const sh = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_SCHEDULE'));

  //データ部分の指定
  const lastRow = sh.getLastRow();
  const lastColumn = sh.getLastColumn();
  const header = sh.getRange(1,1,1,lastColumn).getValues().flat(); //見出しを取得して1次元配列に
  let dataTable = sh.getRange(2, 1, lastRow - 1, lastColumn);

  //ソート条件
  const setting = [
    {column : header.indexOf('date') + 1, ascending : true},  // 日付
    {column : header.indexOf('dateTime2') + 1, ascending : true}  //　開演時刻
  ];

  //ソート実行
  dataTable.sort(setting); 
}

// スプシのライブ一覧シートの行列幅を、一覧全体で見やすくなるように調整するスクリプト
function adjustCellsSize_small() {
  //作業シートの指定
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(configOshiLive('SS_ID')));
  const sh = ss.getSheetByName(configOshiLive('SS_SHEET_NAME_SCHEDULE'));

  const lastRow = sh.getLastRow();
  const lastColumn = sh.getLastColumn();
  const header = sh.getRange(1,1,1,lastColumn).getValues().flat(); //見出しを取得して1次元配列に

  //以下設定
  //見出し行の高さ
  sh.setRowHeightsForced(1, 1, 30);  
  //データ行の高さ。全て1行分に設定
  sh.setRowHeightsForced(2, lastRow - 1, 21);

  //列の幅
  sh.autoResizeColumn(header.indexOf('id') + 1);
  sh.setColumnWidth(header.indexOf('venue') + 1, 120);
  sh.setColumnWidth(header.indexOf('name') + 1, 412);
  sh.autoResizeColumn(header.indexOf('date') + 1);
  sh.setColumnWidth(header.indexOf('dateTime1') + 1, 60);
  sh.setColumnWidth(header.indexOf('dateTime2') + 1, 60);
  sh.setColumnWidth(header.indexOf('dateTime3') + 1, 60);
  sh.setColumnWidth(header.indexOf('member') + 1, 650);
  sh.setColumnWidth(header.indexOf('memberHtml') + 1, 100);
  sh.setColumnWidth(header.indexOf('price1') + 1, 70);
  sh.setColumnWidth(header.indexOf('price2') + 1, 70);
  sh.setColumnWidth(header.indexOf('notice') + 1, 400);
  sh.setColumnWidth(header.indexOf('url1') + 1, 50);
  sh.setColumnWidth(header.indexOf('url2') + 1, 50);
  sh.setColumnWidth(header.indexOf('url3') + 1, 50);
  sh.setColumnWidth(header.indexOf('url4') + 1, 50);
  sh.setColumnWidth(header.indexOf('slackResult') + 1, 50);
  sh.setColumnWidth(header.indexOf('gCalendarResult') + 1, 50);
  sh.setColumnWidth(header.indexOf('twitterResult') + 1, 50);

}

//スプレッドシートを開いた直後に実行するスクリプト。
function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('▶追加メニュー')
    .addSubMenu(
      ui.createMenu('推しライブ')
        .addItem('劇場リストシートの内容を検索対象に設定', 'readTheaters')
        .addSeparator()
        .addItem('検索キーワードの確認', 'showKeyWords')
        .addItem('検索キーワードの設定', 'saveKeyWords')
        .addSeparator()
        .addItem('外部サービスの連携設定', 'savePostFlgs')
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu('Twitter認証')
        .addItem('認証の実行', 'startoauth')
        .addSeparator()
        .addItem('ログアウト', 'reset')
    )
    .addSubMenu(
      ui.createMenu('Googleカレンダー')
        .addItem('削除候補リストアップ', 'listUpLiveInCalendar')
        .addItem('指定した予定を削除', 'deleteLiveInCalendar')
    )
    .addSeparator()
    .addItem('過去公演をアーカイブ', 'archiveSchedule') // ここを追加
    .addToUi();
}
