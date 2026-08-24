---
id: pages-shunt
title: Pages部署静态网站分流加速
excerpt: 本文教你怎么通过多个平台的 Pages 托管服务加上分流 实现像 D-blog 一样的全球低延迟快速访问 备案域名使用效果更佳
date: 2026-08-24
updatedAt: 2026-08-24
category: 教程
tags:
  - Cloudflare Pages
  - EdgeOne Pages
  - 网站加速
  - DNS分流
coverImage: https://img.pldduck.com/20260824125629016.png
author: 跑路的duck
featured: false
series: false
draft: false
---
# 先看看 D-blog 实现后的效果

## Ping 延迟

![Ping 延迟](https://img.pldduck.com/20260824125807490.png)  

## 国内外分流

> 国内 EdgeOne Pages (现在叫 Makers)
> 国外 Cloudfalre Pages

![国内外分流](https://img.pldduck.com/20260824130119432.png)

# 教程

## 第一步:确认DNS商支持DNS分流解析

Cloudflare 不支持DNS解析分流  
建议使用 DNSPOD  
如果想继续把主域名留在 Cloudflare 或其他服务器  
可以选择把子域名 如 blog.pldduck.com 托管到 DNSPOD  
只需要在 DNSPOD 里添加并在 CLoudflare 里为子域名添加NS记录即可  
如下图  

![D-blog 子域名托管 DNSPOD](https://img.pldduck.com/20260824135454621.png)  
![D-blog 子域名DNS记录](https://img.pldduck.com/20260824135539736.png)  

## 第二步:部署 Pages

### Cloudflare Pages 部署

![Cloudflare Pages 部署 - 1](https://img.pldduck.com/20260824135756559.png)  
点击 新建应用程序  

![Cloudflare Pages 部署 - 2](https://img.pldduck.com/20260824141433249.png)  
点击 部署Pages?开始使用  

![Cloudflare Pages 部署 - 3](https://img.pldduck.com/20260824141607108.png)
部署方式自行选择 如果是直接上传源码ZIP文件就选下面的

![Cloudflare Pages 部署 - 4](https://img.pldduck.com/20260824141726416.png)
在项目列表选择自定义域并绑定(获取CNAME地址 等下解析用)  

### EdgeOne Makers 部署

![EdgeOne Makers 部署 - 1](https://img.pldduck.com/20260824141859639.png)
点击创建项目 同样的 需要绑定Git仓库就选择 导入Git仓库 直接上传源码ZIP就选择直接上传  
可用区-自行选择 如果没有备案：选择 全球可用区（不含中国大陆） 如果已备案：选择 全球可用区（含中国大陆） 

![EdgeOne Makers 部署 - 2](https://img.pldduck.com/20260824142056859.png)
同样来到项目页 点击 域名管理
添加和刚刚在 Cloudflare Pages 添加的一样的域名 并同样记录下CNAME地址

## 第三步:分流解析

打开DNSPOD  

如图添加两条记录  
一条 默认 指向 Cloudflare Pages 的CNAME  
另一条选择 境内 指向 EdgeOne Makers 的CNAME  
![分流解析](https://img.pldduck.com/20260824142443320.png)  

## 第四步:完善SSL

由于分流原因  EdgeOne Makers 可能无法自动申请SSL  
需要使用第三方网页并手动上传部署  
我是用的是 [Certple](https://certple.zeoseven.com/)  

获得SSL证书后来到 [腾讯云SSL管理](https://console.cloud.tencent.com/ssl) 上传证书

最后回到 EdgeOne Makers 的域名管理  

![EdgeOne Makers SSL配置 - 1](https://img.pldduck.com/20260824143005125.png) 
点击HTTPS下的 配置 按钮  

![EdgeOne Makers SSL配置 - 2](https://img.pldduck.com/20260824143046079.png)  
点击 配置

![EdgeOne Makers SSL配置 - 3](https://img.pldduck.com/20260824143113253.png)
选择SSL托管证书 并勾选刚刚上传的证书 然后点击保存

最后等待部署完成就好了

## 第五步:验证分流

最后前往 [ITDOG](https://itdog.cn/ping) 测试分流是否成功  
如果成功 国外节点IP位置应该显示 Cloudflare anycast  
国内节点IP位置应在国内(如果在部署时选择的是 全球可用区不含中国大陆 则为其他国家IP)  

# 总结

所有内容到此就结束了  
通过这样的DNS分流 可以有效加快国内外的访问速度  
同时减轻单个平台的压力 避免风控  
此教程建议已备案域名使用 备案域名使用效果更佳
