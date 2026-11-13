const config = require('./config')

App({
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '基础库过低',
        content: '请把调试基础库调到 2.2.3 以上，并使用支持云开发的微信开发者工具。',
        showCancel: false
      })
      return
    }
    const options = { traceUser: true }
    if (config.envId) options.env = config.envId
    wx.cloud.init(options)
  },
  globalData: {
    user: null
  }
})
