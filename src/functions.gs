/*
// メイン機能に関わらない独自関数を定義するファイル
*/

// サロゲートペアや絵文字を考慮して文字数をカウントする
//　例　console.log(countGrapheme('🏴󠁧󠁢󠁥󠁮󠁧󠁿'));　// => 1
function countGrapheme(string) {
  const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
  return [...segmenter.segment(string)].length;
}

// 半角文字は1文字、それ以外は2文字として文字数カウントする
function countBite(text) {
  let len = 0;

  for (const char of [...text]) {
    const code = char.charCodeAt(0);

    let f = code >= 0x0 && code < 0x81;
    f |= code == 0xf8f0;
    f |= code >= 0xff61 && code < 0xffa0;
    f |= code >= 0xf8f1 && code < 0xf8f4;

    if (!!f) {
      len += 1;
    } else {
      len += 2;
    }
  }
  return len;
}

// 連想配列のキーと値をすべて連結した文字列を返す。第二引数はキーと値の区切り文字、第三引数はセットをそれぞれ区切る文字。
var joinObj = function(obj, fDelimiter, sDelimiter) {
	var tmpArr = [];

	if (typeof obj === 'undefined') return '';

	if (typeof fDelimiter === 'undefined') fDelimiter = '';
	if (typeof sDelimiter === 'undefined') sDelimiter = '';

	for (var key in obj) {
		tmpArr.push(key + fDelimiter + obj[key]);
	}

	return tmpArr.join(sDelimiter);
};

// 複数の特定要素のうちひとつでも当てはまったら true を返す
//arrはキーワードの配列、targetは検索対象の配列またはテキスト。
const isIncludes = (arr, target) => arr.some(el => target.includes(el));
// 複数の特定要素のうち全部当てはまったら true を返す
const isAllIncludes = (arr, target) => arr.every(el => target.includes(el));

// Date型を渡すと、祝日ならtrueを返す
function isHoliday(targetDate) {
  // 日本の祝日カレンダーのIDを定義
  const holidayCalendarId = configOshiLive('HOLIDAY_CALENDAR_ID');
  // カレンダーIDを使用してカレンダーを取得
  const calendar = CalendarApp.getCalendarById(holidayCalendarId);
  // ターゲットの日付のイベント（祝日）を取得
  const events = calendar.getEventsForDay(targetDate);
  // イベントが存在するかどうかをチェック（存在すれば祝日、存在しなければ非祝日）
  return events.length > 0;
}

// date型を渡すと、その曜日を日本語一文字で返す
function getDayJp(targetDate) {
  // 曜日の準備
  const ary = ['日', '月', '火', '水', '木', '金', '土'];
  const weekNum = targetDate.getDay();
  return ary[weekNum];
}

