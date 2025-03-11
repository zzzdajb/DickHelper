// 所有的 Node.js API 都可以在预加载过程中使用。
// 它拥有与Chrome扩展一样的沙盒。
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});

// 如果需要暴露Node.js功能给渲染进程，可以在这里设置
// 例如：
// window.electronAPI = {
//   someFunction: () => {}
// }