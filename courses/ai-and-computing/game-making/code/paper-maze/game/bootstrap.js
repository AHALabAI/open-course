window.addEventListener('error', event => {
  if (!event.message) return;
  document.querySelector('#error').hidden = false;
  document.querySelector('#error-text').textContent = '游戏暂时没有打开，请刷新页面或使用支持 WebGL 的 Chrome、Edge 浏览器。错误：' + event.message;
});
if (location.protocol === 'file:') {
  document.querySelector('#error').hidden = false;
  document.querySelector('#error-text').textContent = '请双击游戏目录的 start.cmd，再从本地页面进入游戏。';
}
