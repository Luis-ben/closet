export function showToast(title: string, icon: WechatMiniprogram.ShowToastOption["icon"] = "none") {
  wx.showToast({
    title,
    icon
  });
}

export function showLoading(title = "加载中") {
  wx.showLoading({
    title,
    mask: true
  });
}

export function hideLoading() {
  wx.hideLoading();
}

export function showConfirm(content: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title: "确认",
      content,
      confirmText: "确定",
      cancelText: "取消",
      success(result) {
        resolve(result.confirm);
      },
      fail() {
        resolve(false);
      }
    });
  });
}
