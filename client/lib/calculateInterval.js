export default function calculateInterval(length) {
  let interval = Math.floor(10000 / length)
  if (interval > 2000) interval = 2000
  return interval
}
