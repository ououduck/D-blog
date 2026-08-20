---
id: cf-randompic
title: 通过Cloudflare规则实现纯静态随机图API
excerpt: 本文教你通过Cloudflare规则实现纯静态随机图API 无需后端服务器 部署在Cloudflare Pages/其他可直接访问的存储(OSS COS)
date: 2026-08-20
updatedAt: 2026-08-20
category: 教程
tags:
  - Cloudflare
  - Cloudflare Pages
  - Cloudfalre Rule
  - RandomPIC
  - 随机图
coverImage: https://img.pldduck.com/20260820143641322.png
author: 跑路的duck
featured: false
series: false
draft: false
---
# 通过Cloudflare规则实现纯静态随机图

参考项目 [D-RandomPIC](https://github.com/ououduck/D-RandomPIC/)

基于 Cloudflare Pages 404 规则与 GitHub Actions 自动构建的随机图 API。

访问 `https://randompic.pldduck.com/ecy-v` 之类的地址即可获得一张随机图片。

# 演示
![随机图演示](https://randompic.pldduck.com/ecy-h) 

## 工作原理

不依赖任何后端服务，完全由静态文件与 Cloudflare 规则实现随机取图：

1. `gen_pic.py` 扫描 `pic/` 下的分类子文件夹，将每个分类的图片复制到 `dist/<分类>/` 目录下，并按十六进制编号重命名，生成 `000.jpg` 到 `fff.jpg` 共 4096 个文件（对应规则中 3 位十六进制 hash 的全部取值，覆盖所有可能路径，保证不会 404）。
2. 构建产物 `dist/` 部署到 Cloudflare Pages。
3. 在 Cloudflare 为该 Pages 项目配置 404 规则（见 `rule.txt`）：
  ```
   concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 3), ".jpg")
  ```

当用户访问 `/ecy-v` 时，如果该路径不存在（返回 404），规则会使用随机种子生成 3 位十六进制字符串并重写到 `/ecy-v/xxx.jpg`，从而随机返回该分类下的一张图片。

## D-RandomPIC 目录结构

```
D-RandomPIC/
├── gen_pic.py            # 构建脚本：生成 dist/ 下的随机图片文件
├── index.html            # 演示页面（列出各分类 API 地址）
├── 404.html              # 404 响应体
├── rule.txt              # Cloudflare 404 规则表达式
├── pic/                  # 源图片目录（按分类存放）
│   ├── ecy-h/            # 随机二次元图（横屏/电脑）
│   ├── ecy-v/            # 随机二次元图（竖屏/手机）
│   ├── fj/               # 其他分类示例
│   └── ys/               # 其他分类示例
└── dist/                 # 构建产物（由 gen_pic.py 生成，不提交到仓库）
```

> 新增图片分类时，只需在 `pic/` 下新建一个子文件夹并放入图片，推送到仓库即可，构建脚本与 Cloudflare 规则无需改动。

## 本地构建测试

需要 Python 3（仅使用标准库，无需安装任何依赖）。

```bash
python gen_pic.py
```

构建完成后检查 `dist/` 目录，每个分类下应生成 4096 个文件（`000.jpg` 到 `fff.jpg`）。

## 部署方法

### 1.Fork [D-RandomPIC](https://github.com/ououduck/D-RandomPIC/)

将 [D-RandomPIC](https://github.com/ououduck/D-RandomPIC/) Fork一份到你的Github

### 2.创建 Pages 项目

在 Cloudflare Dashboard 中创建 Pages 项目  
选择直传项目 Direct Upload  

### 3.配置 GitHub Actions Secrets


| 名称 | 说明 |
| ------------------------- | ---------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token，需具备 Pages 编辑权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID（Dashboard 首页右下角可查看） |
| `CLOUDFLARE_PROJECT_NAME` | 创建Pages时填写的项目名称(如果填写 d-randompic 可忽略此变量) |


#### CLOUDFLARE_API_TOKEN 获取方法

![获取API-1](https://img.pldduck.com/20260820141442479.png)  
点击右上角 支持 右边的 账户图标  
![获取API-2](https://img.pldduck.com/20260820141557432.png)  
点击配置文件  
![获取API-3](https://img.pldduck.com/20260820141715821.png)  
选择API令牌 点击右上角创建令牌  
![获取API-4](https://img.pldduck.com/20260820141900773.png)
选择创建自定令牌  
![获取API-5](https://img.pldduck.com/20260820141803560.png)  
按照上图配置权限  
最后点击获取令牌就可以得到令牌了  

#### CLOUDFLARE_ACCOUNT_ID 获取方法

![获取账户ID](https://img.pldduck.com/20260820142109415.png)  
红色码住的这一段就是 也可以随便找个域名的页面进去的右侧下滑就有  

### 4.配置 404 规则

配置Rules 为 404 状态码配置重写规则 表达式见 `rule.txt`  

找到随机图要使用的域名 点击进入  
![配置Rules-1](https://img.pldduck.com/20260820142333847.png)
在左侧菜单栏里找到 规则>概述 
![配置Rules-2](https://img.pldduck.com/20260820142520728.png)  
点击创建规则  
![配置Rules-3](https://img.pldduck.com/20260820142603272.png)  
选择URL重写规则  
![配置Rules-4](https://img.pldduck.com/20260820142708391.png)  
选择自定义表达式
![配置Rules-5](https://img.pldduck.com/20260820142849486.png)  
按照上图配置 
重写到 后面的内容如下  

```
concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 3), ".jpg")
```

最后保存即可 

### 5.触发Action

![](https://img.pldduck.com/20260820143052442.png)  
进入action页面后 找到左侧的Build and Deploy to Cloudflare Pages 
点击右侧的Run workflow  
再次点击绿色的Run workflow  
最后等待部署成功即可  

## API 使用

- `GET /ecy-v`：随机二次元图（竖屏/手机）
- `GET /ecy-h`：随机二次元图（横屏/电脑）
- 新增分类 `xxx` 后，`GET /xxx` 即生效

示例：

```bash
curl -L https://randompic.pldduck.com/ecy-v
```

在 HTML 中直接使用：

```html
<img src="https://randompic.pldduck.com/ecy-v" alt="随机图片">
```

