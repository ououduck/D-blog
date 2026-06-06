---
id: dnspod-cloudflare-accelerate
title: Cloudflare + DNSPOD 实现全球分流
excerpt: 通过 DNSPod 智能解析、腾讯云 CDN 和 Cloudflare for SaaS 配置，实现网站境内外分流与全球访问加速。
date: 2026-06-06
updatedAt: 2026-06-06
category: 教程
tags:
  - Cloudflare
  - DNSPod
  - 腾讯云CDN
  - 网站加速
  - CDN
  - DNS分流
  - 全球加速
coverImage: /posts-img/dnspod-cloudflare-cover.png
author: 跑路的duck
---

# Cloudflare + DNSPOD 实现全球分流  

> 本文根据掘金转载内容整理迁移，原文链接：`https://juejin.cn/post/7538282563052617737`

## 前言

我们在使用 Cloudflare 的 CDN 加速服务时，境内外的访问速度总是难以兼顾。要么国内用户遭遇延迟，要么海外访问缓慢，从而陷入这种“顾此失彼”的困境。

本文以 Cloudflare 与腾讯云 CDN 为例，介绍如何通过 Cloudflare + DNSPod 云解析，构建智能分流系统。帮助你的网站在全球范围内实现更优访问路径。无论访客来自北京还是纽约，都能享受到更稳定的访问体验。

## 适用场景

- 主域名需要国内外分流：国内走国内 CDN，境外走 Cloudflare
- 希望同时优化海内外访问速度
- 已有域名解析权限，并准备好源站服务器 IP


---

## 第一步：前期准备——搭建“数字中转站”

### 1. 域名规划

- 主域名：`ym.com`，用于正常使用，用户实际访问输入的域名
- 中转域名：`ym.cn`，用于分流的工具域名

### 2. 账号规划

- 一个 Cloudflare 账号
- 一个腾讯云账号

### 3. 将两个域名添加到 Cloudflare 与腾讯云

#### （1）腾讯云

登录腾讯云，搜索 **内容分发网络 CDN**。

![腾讯云 CDN 控制台](/posts-img/dnspod-cloudflare-02.webp)

进入域名管理，点击添加域名，**加速域名** 填写用户要实际访问的域名（如 `ym.com`），**源站** 选择自有源，**地址** 填写你的服务器 IP，然后点击下一步。

![腾讯云添加加速域名](/posts-img/dnspod-cloudflare-03.webp)

选择 **跳过推荐**。

![腾讯云跳过推荐](/posts-img/dnspod-cloudflare-04.webp)

如果域名本身就在腾讯云注册，这里可以点击 **一键配置**，也可以先点 **完成**，稍后自行手动配置。

![腾讯云一键配置提示](/posts-img/dnspod-cloudflare-05.webp)

#### （2）Cloudflare

登录 Cloudflare，点击 **添加域**。

![Cloudflare 添加域](/posts-img/dnspod-cloudflare-06.webp)

输入分流用的工具域名。

![Cloudflare 输入工具域名](/posts-img/dnspod-cloudflare-07.webp)

选择 **Free 计划**。

![Cloudflare 选择 Free 计划](/posts-img/dnspod-cloudflare-08.webp)

Cloudflare 会扫描域名已有的解析信息，通常新注册域名会是空白内容，然后点击 **继续前往激活**。

![Cloudflare 扫描 DNS 记录](/posts-img/dnspod-cloudflare-09.webp)

根据提示前往你的域名注册商，将 **NameServer** 改成 Cloudflare 提供的 DNS 服务器。

![Cloudflare NameServer 配置](/posts-img/dnspod-cloudflare-10.webp)

### 4. 开通 Cloudflare for SaaS 服务

- 进入 Cloudflare 后台 → `SSL/TLS` → `自定义主机名`
- 需要绑定信用卡或 PayPal（需要帮忙可以联系我）
- 前 100 个域名支持免费订阅，对大多数个人场景已经够用

![开通 Cloudflare for SaaS](/posts-img/dnspod-cloudflare-11.webp)

![Cloudflare for SaaS 开通确认](/posts-img/dnspod-cloudflare-12.webp)

---

## 第二步：配置 Cloudflare 回退源

### 1. 添加回退源（Fallback Origin）

- 在 DNS 设置中新增一条 A 记录
- 记录值指向源站 IP
- 确保代理状态开启，也就是小黄云图标亮起

![添加回退源 A 记录](/posts-img/dnspod-cloudflare-13.webp)

### 2. 配置回退源

进入 `SSL/TLS` → `自定义主机名`，填写回退源地址，例如 `htname.ym.cn`。

![配置回退源地址](/posts-img/dnspod-cloudflare-14.webp)

### 3. 自定义主机名

#### （1）添加主域名

- 在 **自定义主机名** 页面填写主域名，例如 `www.ym.com`
- 选择最低 TLS 版本
- 证书验证方式选择 **HTTP 验证**

![添加自定义主机名](/posts-img/dnspod-cloudflare-15.webp)

添加之后下方可能暂时显示无效，这通常是因为回退源解析尚未完全生效。等后面的分流解析加上后，再等待 2 到 3 分钟，状态一般会恢复为有效。

![自定义主机名状态示意](/posts-img/dnspod-cloudflare-16.webp)

---

## 第三步：DNSPod 配置分流

登录腾讯云，搜索 **云解析 DNS**。

![进入云解析 DNS](/posts-img/dnspod-cloudflare-17.webp)

以 `www.xxxx.com` 为例，我们需要添加两个解析：

- 一个线路类型设置为 **默认**，记录值填写之前在 Cloudflare 上设置的回退源子域名
- 一个线路类型设置为 **境内**，记录值填写之前在腾讯云 CDN 提供的加速地址
- 等待解析生效

### 配置思路总结

- **境外流量**：走 Cloudflare 回退源
- **境内流量**：走腾讯云 CDN
- **最终效果**：国内外访问线路互不干扰，分别走各自最优路径

---

## 第四步：测试访问速度

你可以使用以下工具测试访问效果：

- itdog
- Pingdom
- WebPageTest
- 各类在线测速节点

重点关注不同地区节点的首包时间、加载时间和资源命中情况。

---

## 第五步：注意事项

- 不要直接访问回退源，否则可能触发未备案拦截
- 如果配置后效果不符合预期，优先检查 DNS 缓存是否已经刷新
- 必要时可以清理 Cloudflare 缓存后重新测试

---

## 总结


这样就实现了境外和境内使用不同 CDN 线路的分流方案：

- 境外线路对应 Cloudflare 的回退源地址
- 境内线路对应国内服务商提供的 CDN 地址

通过 DNSPod 智能解析配合 Cloudflare 与腾讯云 CDN，你可以在不改变主站访问域名的前提下，实现更合理的全球加速体验  

## 补充  

此方法同样适用于Pages，只需要把默认解析改为Cloudflare给的Pages域名，境内改为EdgeOne Pages的解析域名就行（但是此方法会导致自动证书申请不可用 需要自行上传证书） （D-blog目前就是这样）