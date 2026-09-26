/** All display dates use Sonora time, regardless of the device's time zone.
 * Attendance timestamps remain UTC instants supplied by the database.
 */
export const TIME_ZONE = "America/Hermosillo";
const clock = new Intl.DateTimeFormat("es-MX", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const calendar = new Intl.DateTimeFormat("es-MX", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const record = new Intl.DateTimeFormat("es-MX", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export const formatTime = (date: Date | string) => clock.format(new Date(date));
export const formatDate = (date: Date | string) =>
  calendar.format(new Date(date));
export const formatRecordDate = (date: Date | string) =>
  record.format(new Date(date));
