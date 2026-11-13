function call(action, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'api',
      data: Object.assign({ action: action }, data || {}),
      success(res) {
        const result = res.result
        if (!result || result.ok !== true) {
          const error = new Error((result && result.message) || '请求失败')
          error.reason = result && result.reason
          error.payload = result
          reject(error)
          return
        }
        resolve(result)
      },
      fail(err) {
        const raw = (err && err.errMsg) || '云函数调用失败'
        const error = new Error(explainCloudError(raw))
        error.reason = 'cloud'
        reject(error)
      }
    })
  })
}

function explainCloudError(raw) {
  if (raw.indexOf('FunctionName') >= 0 || raw.indexOf('cloud function') >= 0) {
    return '云函数 api 还没有部署。在开发者工具里右键 cloudfunctions/api，选择「上传并部署：云端安装依赖」。'
  }
  if (raw.indexOf('Environment not found') >= 0 || raw.indexOf('env not exists') >= 0) {
    return '没有找到云开发环境。请先开通云开发，或在 miniprogram/config.js 填入环境 ID。'
  }
  return raw
}

function showError(err) {
  const message = (err && err.message) || '请稍后再试'
  wx.hideLoading({
    complete() {
      setTimeout(() => {
        if (message.length > 18) {
          wx.showModal({
            title: '没有完成',
            content: message,
            showCancel: false
          })
          return
        }
        wx.showToast({ title: message, icon: 'none' })
      }, 60)
    }
  })
}

function withLoading(work) {
  wx.showLoading({ title: '请稍候', mask: true })
  return Promise.resolve()
    .then(work)
    .then((value) => {
      wx.hideLoading()
      return value
    })
    .catch((err) => {
      showError(err)
      throw err
    })
}

function provider() {
  try {
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync()
    if (info.host && info.host.env === 'QQ') return 'qq'
  } catch (err) {
    return 'wechat'
  }
  return 'wechat'
}

module.exports = {
  call: call,
  showError: showError,
  withLoading: withLoading,
  provider: provider
}
