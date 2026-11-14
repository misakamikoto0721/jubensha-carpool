const api = require('../../utils/api')
const session = require('../../utils/session')
const time = require('../../utils/time')

const KIND_TEXT = { weekly: '周常', private: '私车' }

function decorate(chat) {
  return Object.assign({}, chat, {
    kindText: KIND_TEXT[chat.kind] || '',
    timeText: chat.lastAt ? time.formatDateTime(chat.lastAt) : ''
  })
}

Page({
  data: {
    loading: true,
    user: null,
    studentId: '',
    groups: [],
    privates: []
  },

  onShow() {
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh())
  },

  refresh() {
    this.setData({ loading: true })
    return session.loadMe()
      .then((me) => {
        this.setData({ user: me.user })
        if (!me.user) {
          this.setData({ loading: false, groups: [], privates: [] })
          return null
        }
        return Promise.all([
          api.call('listSessionChats'),
          api.call('listPrivateChats')
        ])
      })
      .then((pair) => {
        if (!pair) return
        this.setData({
          loading: false,
          groups: (pair[0].chats || []).map(decorate),
          privates: (pair[1].chats || []).map(decorate)
        })
      })
      .catch((err) => {
        this.setData({ loading: false })
        api.showError(err)
      })
  },

  onStudentId(event) {
    this.setData({ studentId: event.detail.value })
  },

  openPrivate() {
    const studentId = String(this.data.studentId || '').trim()
    if (!studentId) {
      wx.showToast({ title: '先填写学号', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/chat/private/private?studentId=' + encodeURIComponent(studentId)
    })
  },

  openThread(event) {
    wx.navigateTo({
      url: '/pages/chat/private/private?studentId=' + encodeURIComponent(event.currentTarget.dataset.id)
    })
  },

  openGroup(event) {
    wx.navigateTo({ url: '/pages/chat/group/group?id=' + event.currentTarget.dataset.id })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
