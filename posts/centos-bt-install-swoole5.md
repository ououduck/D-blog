---
id: centos-bt-install-swoole5
title: CentOS 宝塔面板无法安装 Swoole5 解决教程
excerpt: 教你解决CentOS 宝塔面板无法安装 Swoole5 的问题
date: 2026-02-24
category: 技术
tags:
  - Swoole5 编译报错
  - CentOS 安装 Swoole5
  - 宝塔面板 Swoole 安装失败
  - brotli-devel 安装
  - PHP Swoole 扩展安装
readTime: 3分钟阅读
coverImage: https://fogpic-vip.3pw.pw/20260224/414222b1fed96b55df9fc05e6088e678.png
---

# CentOS 宝塔面板无法安装 Swoole5 解决教程

## 教程介绍

最近在给程序部署环境时，发现 **CentOS 系统下的宝塔面板始终无法安装 Swoole 5**，无论怎么点击安装都会失败。

排查后发现并不是 Swoole 本身问题，而是系统缺少相关依赖库。于是整理了这篇教程，记录完整解决过程，方便遇到同样问题的朋友参考。

---

## 问题现象

在宝塔面板中安装 Swoole5 时：

- 安装失败  
- 编译报错  
- 提示缺少依赖  

通常是因为系统缺少 `brotli-devel` 相关依赖。  

---

## 解决步骤

### 第一步：更新系统源

执行以下命令：

```bash
yum update
```

![1000015206](https://fogpic-vip.3pw.pw/20260224/fed99ce78e130aa58ef58f0b61799616.png)

### ⚠ 注意

如果执行 `yum update` 出现报错，例如：

- 无法连接镜像源  
- DNS 解析失败  
- 下载失败  

说明你的 CentOS 镜像源有问题，需要自行更换国内镜像源（如阿里云、腾讯云镜像源。    

[如何更换CentOS镜像源](https://cn.bing.com/search?q=centos%E6%8D%A2%E6%BA%90&setmkt=zh-CN&PC=EMMX01&form=LBT003&scope=web)

---

### 第二步：安装缺失依赖

执行命令安装 `brotli-devel`：

```bash
yum install brotli-devel
```

![1000015207](https://fogpic-vip.3pw.pw/20260224/16eafe896c6397a16f0a0d57c375ae0e.png)

安装完成后，可确认是否安装成功。

---

### 第三步：重新安装 Swoole5

回到宝塔面板：

1. 进入【软件商店】  
2. 找到对应 PHP 版本  
3. 安装 Swoole5  

此时应该可以正常编译并安装成功。

![1000015208](https://fogpic-vip.3pw.pw/20260224/61522ff53ab9e6f694c468e4fa54172f.png)

---

## 原因分析

Swoole 5 在编译时依赖 `brotli` 压缩库，如果系统中没有 `brotli-devel`，就会导致编译失败。

CentOS 默认环境中通常不会自带该依赖，因此需要手动安装。

---

## 总结

如果你在 **CentOS + 宝塔面板** 环境下安装 Swoole5 失败，可以按照以下顺序排查：

1. 执行 `yum update`  
2. 安装依赖 `yum install brotli-devel`  
3. 重新安装 Swoole5  

基本都可以解决问题。
