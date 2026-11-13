module.exports = {
  noShowThreshold: 2,
  banDays: 14,
  // 统一认证的 client_id、client_secret、redirect_uri 只放在云函数环境变量：
  // USTC_CLIENT_ID、USTC_CLIENT_SECRET、USTC_REDIRECT_URI
  // 不要写进这个文件。回调地址必须和学校登记的完全一致。
  // 每个人的身份写在自己的 users 文档 role 上：player、dm、admin。
  // 管理员通过 setRole 把别人的 role 改成 dm 或 player。管理员身份不在小程序里授予。
}
