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
