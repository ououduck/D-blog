/**
 * 将 "YYYY-MM-DD" 格式的日期字符串解析为本地时区的 Date 对象。
 *
 * 使用 new Date(year, month, day) 而非 new Date(dateText)：后者会把
 * "2026-03-14" 解析为 UTC 午夜，在 UTC+8 等东时区会倒退到前一天，
 * 导致文章排序与日期格式化出错。本地时区构造保证日历日始终正确。
 */
export const parseISODate = (dateText: string) => {
  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return new Date(Number.NaN);
  }

  return new Date(year, month - 1, day);
};

export const getDateTimestamp = (dateText: string) => {
  const timestamp = parseISODate(dateText).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

export const formatDate = (
  dateText: string,
  locale: string,
  options: Intl.DateTimeFormatOptions
) => {
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
