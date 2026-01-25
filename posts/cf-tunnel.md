
# 使用Cloudflare Tunnel轻松实现内网穿透

## 引言

在日常开发和运维中，我们经常遇到需要从公网访问本地网络服务的需求。传统的做法可能涉及复杂的配置或高昂的成本。然而，随着Cloudflare Tunnel的出现，这一切都变得简单而高效。

## Cloudflare Tunnel简介

Cloudflare Tunnel通过建立一条安全、加密的隧道，将本地的服务暴露到公网，无需公网IP地址或端口转发。这不仅简化了内网穿透的过程，还提升了安全性。

## 主要功能

- **内网穿透**：允许公网用户访问位于私有网络中的服务。
- **端口转发**：支持将非常规端口的请求转发至常规端口号（如80/443）。
- **自动HTTPS**：为您的服务自动配置SSL证书，确保数据传输的安全性。
- **额外认证**：为您的服务添加额外的安全层，提高访问控制。

## 工作原理

Cloudflare Tunnel利用Cloudflare全球网络作为中介，通过运行在本地服务器上的`cloudflared`守护程序与Cloudflare云端进行通信，从而实现在公网访问本地服务的目的。

## 开始使用Cloudflare Tunnel

### 前置条件

- 拥有一个域名，并将DNS解析托管于Cloudflare
- 内网中有一台能够运行`cloudflared`程序的服务器
- 一张国际双币信用卡（仅用于验证，不会产生费用）（其实没有也可以 有骚操作）

### 步骤1：注册并登录Cloudflare

首先，前往[Cloudflare Zero Trust](https://one.dash.cloudflare.com/)注册账号并登录。

### 步骤2：创建Tunnel

![创建Tunnel图片1](https://cdn.imgos.cn/vip/2026/01/25/6975b7b791a5f.webp)
先设置团队名称 随便写

![创建Tunnel图片2](https://cdn.imgos.cn/vip/2026/01/25/6975b7fa6ecc9.webp)
选择免费计划

![创建Tunnel图片3](https://cdn.imgos.cn/vip/2026/01/25/6975b7fa6ecc9.webp)
添加付款方式这一步很重要，有卡的直接绑定即可，反正免费，没卡的有一个骚操作，在这个页面直接关闭 重新进入[Cloudflare Zero Trust](https://one.dash.cloudflare.com/)就可以跳过。

![创建Tunnel图片4](https://cdn.imgos.cn/vip/2026/01/25/6975b94d310bd.webp)
最后直接在Access Tunnels中，创建一个Tunnel

这样创建Tunnel的步骤就完成了

### 步骤3：安装并配置`cloudflared`

![配置cloudflared图片](https://cdn.imgos.cn/vip/2026/01/25/6975b96adb9f1.webp)
根据官方指南，在您的本地服务器上安装`cloudflared`并配置Tunnel连接。以下是一个示例命令：

```bash
docker run --name cloudflared -d --restart unless-stop cloudflare/cloudflared:latest tunnel --no-autoupdate run --token YOUR_TOKEN_HERE
```

请记得替换`YOUR_TOKEN_HERE`为您自己的Token。

### 步骤4：配置域名和转发规则

![配置域名图片](https://cdn.imgos.cn/vip/2026/01/25/6975b9d88f198.webp)
为你的域名配置一个子域名（Subdomain），Path 留空，URL 处填写内网服务的IP加端口号。注意 Type 处建议使用 HTTP，因为 Cloudflare 会自动为你提供 HTTPS，因此此处的转发目标可以是 HTTP 服务端口。

### 现在，你就能通过刚刚设置的子域名直接在公网访问你的内网项目了

## 安全增强

为了进一步提升安全性，您可以为服务添加基于Email、IP等多种方式的身份验证。

## 结论

Cloudflare Tunnel以其简便的配置和强大的功能，成为开发者和运维人员手中的利器。无论是个人项目还是企业应用，它都能提供可靠的支持。

---
