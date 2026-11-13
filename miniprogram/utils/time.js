function pad(number) {
  return String(number).padStart(2, '0')
}

function formatDateTime(ts) {
  const date = new Date(ts)
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  )
}

function splitTimestamp(ts) {
  const date = new Date(ts)
  return {
    date: date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()),
    time: pad(date.getHours()) + ':' + pad(date.getMinutes())
  }
}

function combineDateTime(dateText, timeText) {
  const dateParts = String(dateText || '').split('-')
  const timeParts = String(timeText || '').split(':')
  if (dateParts.length !== 3 || timeParts.length < 2) return NaN
  return new Date(
    Number(dateParts[0]),
    Number(dateParts[1]) - 1,
    Number(dateParts[2]),
    Number(timeParts[0]),
    Number(timeParts[1]),
    0,
    0
  ).getTime()
}

function defaultStart() {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  date.setMinutes(0, 0, 0)
  return date.getTime()
}

module.exports = {
  formatDateTime: formatDateTime,
  splitTimestamp: splitTimestamp,
  combineDateTime: combineDateTime,
  defaultStart: defaultStart
}
