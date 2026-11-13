module.exports = {
  noShowThreshold: 2,
  banDays: 14,
  // 统一认证的 client_id、client_secret、redirect_uri 只放在云函数环境变量：
  // USTC_CLIENT_ID、USTC_CLIENT_SECRET、USTC_REDIRECT_URI
  // 不要写进这个文件。回调地址必须和学校登记的完全一致。
  // 填入学号后重新部署。该学号下次打开小程序时会成为管理员。
  adminStudentIds: []
}
