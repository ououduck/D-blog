export const parseISODate = (dateText: string) => {
  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  return new Date(year, month - 1, day);
};

export const getDateTimestamp = (dateText: string) => parseISODate(dateText).getTime();

export const formatDate = (
  dateText: string,
  locale: string,
  options: Intl.DateTimeFormatOptions
) => new Intl.DateTimeFormat(locale, options).format(parseISODate(dateText));
