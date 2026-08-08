import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { registerServiceWorker } from './registerServiceWorker';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

document.head.querySelectorAll('[data-rh="true"]').forEach((element) => element.remove());

// 生产构建的静态 HTML 已含服务端渲染内容，使用水合接管（hydrateRoot 需一次性传入元素）；
// 开发模式（空 root）走普通客户端渲染。
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (rootElement.childElementCount > 0) {
  ReactDOM.hydrateRoot(rootElement, app);
} else {
  ReactDOM.createRoot(rootElement).render(app);
}

registerServiceWorker();
