function raise(reason, message, extra) {
  const error = new Error(message)
  error.reason = reason
  error.extra = extra || null
  throw error
}

function fromResult(result) {
  if (result && result.ok === false) {
    raise(result.reason, result.message, result)
  }
  return result
}

function toResponse(err) {
  if (err && err.reason) {
    const body = { ok: false, reason: err.reason, message: err.message }
    if (err.extra && err.extra.banUntil) body.banUntil = err.extra.banUntil
    return body
  }
  const msg = String((err && (err.message || err.errMsg)) || '')
  if (msg.indexOf('does not exist') >= 0 || msg.indexOf('不存在') >= 0) {
    return { ok: false, reason: 'not_found', message: '车次不存在或已被删除' }
  }
  const chinese = msg.match(/[\u4e00-\u9fff].*/)
  if (chinese && msg.indexOf('服务暂时不可用') < 0) {
    return { ok: false, reason: 'rejected', message: chinese[0] }
  }
  return null
}

module.exports = {
  raise: raise,
  fromResult: fromResult,
  toResponse: toResponse
}
