/**
 * 将 "YYYY-MM-DD" 格式的日期字符串解析为本地时区的 Date 对象。
 *
 * 使用 new Date(year, month, day) 而非 new Date(dateText)：后者会把
 * "2026-03-14" 解析为 UTC 午夜，在 UTC+8 等东时区会倒退到前一天，
 * 导致文章排序与日期格式化出错。本地时区构造保证日历日始终正确。
 */
const parseISODate = (dateText: string) => {
  // 先整串校验格式：split + parseInt 对尾部垃圾字符（如 "2026-08-12abc"）会
  // 静默取到合法日/月，产出错误时间戳；格式不符一律按无效日期处理。
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateText)) {
    return new Date(Number.NaN);
  }
  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return new Date(Number.NaN);
  }

  const date = new Date(year, month - 1, day);
  // new Date() 会把越界日期静默滚期（如 2026-02-30 → 2026-03-02、2026-13-01 → 2027-01-01），
  // 不会产生 Invalid Date，导致 formatDate 的兜底失效。构造后回查各字段确认输入
  // 日历日真实存在，否则按无效日期处理。
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return new Date(Number.NaN);
  }

  return date;
};

/** 解析 "YYYY-MM-DD" 日期字符串为时间戳；无效日期返回 0。 */
export const getDateTimestamp = (dateText: string) => {
  const timestamp = parseISODate(dateText).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());
/** 格式化日期字符串（本地时区）；无效日期或 locale 不可用时回退原字符串。 */
export const formatDate = (dateText: string, locale: string, options: Intl.DateTimeFormatOptions) => {
  const parsedDate = parseISODate(dateText);
  if (!isValidDate(parsedDate)) {
    return dateText;
  }

  try {
    return new Intl.DateTimeFormat(locale, options).format(parsedDate);
  } catch {
    // 个别 locale/选项组合在旧环境可能抛错，回退为原始字符串。
    return dateText;
  }
};
