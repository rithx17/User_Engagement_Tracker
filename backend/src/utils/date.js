function parseDateInput(value, { endOfDay = false } = {}) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return endOfDay
      ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function parseDateRange(query) {
  const maxRangeDays = 180;
  const safeNow = new Date();
  const endDate = parseDateInput(query.endDate, { endOfDay: true }) || safeNow;
  const fallbackStart = new Date(endDate.getTime() - 1000 * 60 * 60 * 24 * 30);
  const startDate = parseDateInput(query.startDate) || fallbackStart;

  if (startDate > endDate) {
    return {
      startDate: fallbackStart,
      endDate
    };
  }

  const maxWindowStart = new Date(endDate.getTime() - 1000 * 60 * 60 * 24 * maxRangeDays);
  const boundedStartDate = startDate < maxWindowStart ? maxWindowStart : startDate;

  return {
    startDate: boundedStartDate,
    endDate
  };
}
