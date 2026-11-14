const api = require('../../../utils/api')

Page({
  data: {
    messages: [],
    draft: '',
    failed: '',
    anchor: ''
  },

  onLoad(query) {
    this.studentId = decodeURIComponent(query.studentId || '')
  },

  onShow() {
    this.load(false)
    this.arm()
  },

  onHide() {
    this.disarm()
  },

  onUnload() {
    this.disarm()
  },

  onPullDownRefresh() {
    this.load(false).then(() => wx.stopPullDownRefresh())
  },

  arm() {
    this.disarm()
    this.poll = setInterval(() => this.load(true), 4000)
  },

  disarm() {
    if (this.poll) clearInterval(this.poll)
    this.poll = null
  },

  load(quiet) {
    return api.call('listPrivateMessages', { studentId: this.studentId })
      .then((result) => {
        const peer = result.peer || {}
        wx.setNavigationBarTitle({ title: peer.name || '私聊' })
        this.setData({
          messages: result.messages || [],
          failed: '',
          anchor: ''
        })
        this.setData({ anchor: 'bottom' })
      })
      .catch((err) => {
        this.setData({ failed: err.message || '没有打开这条私聊' })
        if (!quiet) api.showError(err)
      })
  },

  onDraft(event) {
    this.setData({ draft: event.detail.value })
  },

  send() {
    const text = String(this.data.draft || '').trim()
    if (!text) return
    api.withLoading(() => api.call('sendPrivateMessage', {
      studentId: this.studentId,
      text: text
    })).then(() => {
      this.setData({ draft: '' })
      return this.load(true)
    }).catch(() => {})
  }
})
