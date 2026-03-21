---
id: openclaw-deploy
title: OpenClaw 部署教程：用 Docker 快速搭建你的私人 AI 助手
excerpt: 从 OpenClaw 是什么，到如何使用 Docker 完成部署、初始化、访问控制台与常见问题排查，这篇文章带你快速上手。
date: 2026-03-21
updatedAt: 2026-03-21
category: 技术
tags:
  - OpenClaw
  - Docker 部署
  - AI 助手
  - 本地部署
  - OpenClaw 教程
coverImage: /posts-img/openclaw-cover.png
author: 跑路的duck
---

# OpenClaw 部署教程：用 Docker 快速搭建你的私人 AI 助手

## 教程介绍

这段时间 OpenClaw 很火，很多人第一次看到它的时候，第一反应都是：这玩意到底是什么，能不能自己部署，部署起来麻不麻烦。

简单来说，**OpenClaw 是一个运行在你自己设备上的个人 AI 助手**。它可以接入 WhatsApp、Telegram、Slack、Discord、Google Chat 等大量消息渠道，也能通过 WebChat、CLI、移动端节点等方式使用。它的定位不是单纯聊天，而是一个真正能调用工具、管理会话、跑自动化流程的“私人 AI 助手”。

如果你不想把所有数据都交给第三方平台，又希望有一个可控、可扩展、能长期运行的 AI 助手，OpenClaw 确实很有吸引力。

![OpenClaw 封面图](/posts-img/openclaw-cover.png)

这篇文章我按照你博客现在的文章风格，整理一份偏实战的 **OpenClaw Docker 部署教程**。内容包括：

- OpenClaw 是什么
- 为什么推荐用 Docker 部署
- 从 0 开始完成部署
- 如何打开控制台并继续初始化
- 常见报错和排查思路

---

## OpenClaw 是什么

根据 OpenClaw 官方 GitHub 项目介绍，它是一个 **personal AI assistant**，也就是“你自己的个人 AI 助手”。和很多只能在网页里聊天的 AI 产品不同，OpenClaw 更像一套完整的本地 Agent 系统。

它的几个核心特点比较值得注意：

### 1. 运行在你自己的设备上

OpenClaw 支持你把网关、配置、工作区都放在自己的机器或 VPS 上，数据和运行环境由你自己控制。

### 2. 支持大量消息渠道

官方仓库里列出的接入渠道很多，比如 WhatsApp、Telegram、Slack、Discord、Signal、iMessage、Google Chat、Matrix、Teams 等。对于想把 AI 接进自己日常沟通工具的人来说，这一点很实用。

### 3. 不只是聊天，而是 Agent

它支持工具调用、会话管理、自动化、技能扩展、浏览器能力以及多 Agent 相关功能。说白了，OpenClaw 更偏“能干活”的 AI，而不只是“会陪聊”的 AI。

### 4. 部署方式比较灵活

官方推荐的安装方式其实是直接用 Node 环境跑 `openclaw onboard`。但如果你想把环境隔离开，不想污染本机依赖，或者准备部署到服务器上，Docker 就很合适。

![OpenClaw Logo](/posts-img/openclaw-logo.svg)

---

## 为什么推荐用 Docker 部署

官方文档里明确提到：**Docker 不是必须的**。如果你只是想在自己的开发机上获得最快的开发体验，直接正常安装会更轻便。

但如果你符合下面这些场景，我会更建议你走 Docker：

- 不想在本机安装一堆依赖
- 想把 OpenClaw 跑在 VPS 或独立环境里
- 希望环境可重复、方便迁移
- 后续准备折腾沙箱、浏览器、自动化等能力

Docker 部署的最大好处就一句话：**干净、可控、出了问题也更好回滚。** 机器不容易被你自己玩成“依赖炼蛊现场”。

---

## 部署前准备

开始之前，先确认下面几件事：

### 必要条件

1. 你的机器已经安装好 Docker
2. 你的机器已经安装好 Docker Compose v2
3. 有一定可用磁盘空间，用来存镜像、日志和配置
4. 能正常访问 GitHub

### 建议环境

- Linux 服务器 / 本地 Linux
- macOS
- Windows 建议通过 WSL2 使用

如果你是 Windows 直接硬跑，也不是完全不行，但 OpenClaw 官方说明里对 **WSL2 是强烈推荐** 的。

---

## OpenClaw Docker 部署步骤

下面这套流程，主要参考 OpenClaw 官方 Docker 文档和官方仓库说明整理。

### 第一步：克隆项目仓库

先把官方仓库拉下来：

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

如果你只是临时试试，建议直接在一台干净机器或单独目录里操作，后面管理起来更省心。

---

### 第二步：使用官方脚本完成 Docker 初始化

官方给了一个最省事的方式，就是直接运行仓库根目录里的脚本：

```bash
./docker-setup.sh
```

这个脚本会一次性帮你做几件事：

1. 构建 OpenClaw 的网关镜像
2. 运行 onboarding 引导
3. 输出模型提供商相关提示
4. 通过 Docker Compose 启动 gateway，并把 token 写入 `.env`

如果你问我“部署 OpenClaw 最简单的姿势是什么”，那基本就是这一句命令。

---

### 第三步：打开控制台

脚本跑完之后，官方文档给出的访问地址是：

```bash
http://127.0.0.1:18789/
```

直接在浏览器打开即可。

然后你需要把脚本生成的 token 填进控制台里的设置页。文档里提到的位置是：

- Settings
- token

如果你后面忘了这个地址或者 token 获取方式，也可以重新执行：

```bash
docker compose run --rm openclaw-cli dashboard --no-open
```

这条命令会重新给你一个控制台入口信息。

---

### 第四步：如果你想手动部署，也可以走 Manual Flow

有些人不喜欢一键脚本，觉得脚本黑盒味太重，想自己把每一步摸清楚。那也可以直接按官方文档里的手动流程来：

```bash
docker build -t openclaw:local -f Dockerfile .
docker compose run --rm openclaw-cli onboard
docker compose up -d openclaw-gateway
```

这三条命令分别对应：

- 手动构建镜像
- 手动跑 onboarding
- 后台启动 OpenClaw Gateway

如果你后面用了额外挂载或自定义 volume，记得按文档要求把 `docker-compose.extra.yml` 一起带上，不然你会发现“我明明配了，怎么没生效”。这类问题特别常见，挺折磨人。

---

## 常用管理命令

部署完之后，下面这些命令很常用。

### 查看 Dashboard 链接

```bash
docker compose run --rm openclaw-cli dashboard --no-open
```

### 查看设备列表

```bash
docker compose run --rm openclaw-cli devices list
```

### 审批设备配对请求

```bash
docker compose run --rm openclaw-cli devices approve <requestId>
```

### 检查网关健康状态

```bash
docker compose exec openclaw-gateway node dist/index.js health --token "$OPENCLAW_GATEWAY_TOKEN"
```

如果你已经能正常打开控制台，但总感觉服务不稳，这条健康检查命令很值得留着。

---

## 可选增强配置

如果你只是想先跑起来，这部分可以先跳过。

但如果你后面打算长期使用，下面几个配置会比较实用。

### 1. 增加额外挂载目录

如果你希望容器里能访问宿主机的一些目录，可以在执行脚本前设置：

```bash
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

这个配置适合需要额外挂载工作目录、配置目录或只读凭据目录的场景。

### 2. 持久化容器 Home 目录

如果你不希望容器重建后 `/home/node` 里的内容丢失，可以使用 named volume：

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

### 3. 安装额外系统依赖

比如你有一些高级需求，想在镜像里预装 git、curl、jq，可以这样：

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="git curl jq"
./docker-setup.sh
```

这招对后面扩展能力很有帮助，不然很多时候你会在容器里发现“命令不存在”，然后开始原地怀疑人生。

---

## 进阶：浏览器与 Playwright 支持

官方文档里还提到一个很有意思的点：默认镜像更偏安全和轻量，**不会内置完整浏览器环境**。如果你后面需要更强的浏览器能力，比如 Playwright / Chromium，可以额外处理。

文档给出的思路大概是：

1. 持久化 home volume
2. 预装系统依赖
3. 手动安装 Playwright 浏览器

例如安装 Chromium：

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

如果你只是部署基础版 OpenClaw，这一步暂时不用做。

---

## 常见问题排查

### 1. 控制台提示 unauthorized 或 pairing required

如果你看到类似：

- unauthorized
- disconnected (1008): pairing required

通常说明你需要重新获取链接并批准设备。

可以依次执行：

```bash
docker compose run --rm openclaw-cli dashboard --no-open
docker compose run --rm openclaw-cli devices list
docker compose run --rm openclaw-cli devices approve <requestId>
```

### 2. 出现权限错误或 EACCES

官方文档里提到，镜像默认以 `node` 用户运行，uid 是 `1000`。如果挂载目录权限不对，就容易报错。

Linux 主机可以这样修正：

```bash
sudo chown -R 1000:1000 /path/to/openclaw-config /path/to/openclaw-workspace
```

### 3. Docker 配好了但改动不生效

如果你改了 Docker 配置或 setupCommand，但容器没有及时重建，官方说明里提到一个“热容器”机制：最近几分钟内刚使用过的容器不会立刻重建。

所以这种情况不要一上来怀疑人生，先看日志提示，再决定是否手动重建。

### 4. 包安装失败

如果你在沙箱里做安装操作失败，常见原因一般是两个：

- 网络默认被禁用了
- 根文件系统只读

这个属于 OpenClaw 安全策略的一部分。安全是好事，但第一次踩进去的时候确实会有点懵。

---

## Docker 部署和普通安装该怎么选

如果你还在纠结到底该不该用 Docker，我给一个简单建议：

### 用普通安装，如果你是：

- 本机使用为主
- 想要最快的开发体验
- 不介意本机装 Node 和相关依赖

### 用 Docker 部署，如果你是：

- 希望环境隔离
- 准备跑在服务器上
- 想更方便迁移和回滚
- 后续可能做多环境管理

也就是说，**Docker 更适合“长期跑服务”**，普通安装更适合“本机快速折腾”。

---

## 总结

OpenClaw 之所以值得折腾，不只是因为它是个开源项目，而是因为它把“私人 AI 助手”这件事做得很完整：有网关、有渠道接入、有工具、有自动化，还有比较成熟的配置和扩展路线。

如果你只是想先跑起来，最推荐的命令就是：

```bash
./docker-setup.sh
```

它几乎就是 OpenClaw Docker 部署的最快入口。跑完之后打开 `http://127.0.0.1:18789/`，继续完成 token 配置和后续接入就行。

如果后面你还想继续折腾，我建议下一步可以看这几个方向：

- 接入 Telegram 或 Discord
- 配置模型提供商
- 打开 WebChat
- 尝试沙箱和浏览器能力

OpenClaw 这玩意，属于一开始看着有点复杂，真跑起来之后就会觉得：嗯，这只龙虾还真挺能干活。

---

## 参考链接

- [OpenClaw GitHub 仓库](https://github.com/openclaw/openclaw)
- [OpenClaw 官方 Docker 文档](https://open-claw.bot/docs/install/docker/)
- [OpenClaw Getting Started](https://docs.openclaw.ai/start/getting-started)
