Page({
  data: {
    url: '',
    blocked: false
  },

  onLoad(query) {
    const url = decodeURIComponent(query.url || '')
    const allowed = url.indexOf('https://id.ustc.edu.cn/cas/oauth2.0/authorize?') === 0
    this.setData({
      url: allowed ? url : '',
      blocked: !allowed
    })
  }
})
