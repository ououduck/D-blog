---
id: pagescms
title: 静态博客接入 PagesCMS
excerpt: 为静态博客新增一个文章管理/写作Web后台 - PagesCMS
date: 2026-08-13
updatedAt: 2026-08-14
category: 技术
tags:
  - PagesCMS
  - 静态博客
coverImage: https://img.pldduck.com/D-blog/20260813145228756.png
author: 跑路的duck
featured: false
series: false
draft: false
---
# D-blog 接入 PagesCMS

当你看到这篇文章时，**D-blog** 已经接入了 **PagesCMS**  
这篇文章也是通过 **PagesCMS** 发布的  
![PagesCMS - 首页](https://img.pldduck.com/D-blog/20260813145352156.png)
![PagesCMS - D-blog](https://img.pldduck.com/D-blog/20260813142147660.png)
我也不知道为什么要从 **Obsidian** 迁移到 **PagesCMS** 因为理论上 **Obsidian** 的文章编辑要比 **PagesCMS** 好太多，可能是为了网页吧，给静态博客加一个理想的后台，也方便随时修改文章  
**PagesCMS** 我用起来其实还是很不错的，唯一让我难受的地方就是它的图片附件管理  
我在用 **Obsidian** 的时候，都是通过附件自动管理插件，每次粘贴图片都会自动移至相应目录下并自动重命名，说实话真的很方便  
在 **PagesCMS** 理论上配置好 *.pages.yml* ，也可以通过 media 文件夹对附件图片有一个较好的管理，但是因为 **PagesCMS** 原理是通过把 GitHub 仓库作为存储库，所以你的每一次上传，它都会进行一次 Git 提交并 Push 到仓库  
这就出现了一个问题：**Cloudflare Pages** 还好，可以关闭自动部署，改为纯手动部署；但是 EdgeOne 配置时就不一样了，因为 **EdgeOne Makers(Pages)** 不允许把 main 生产分支设置为手动部署，自动部署必须开启  
这就导致每次都会触发一次构建，浪费宝贵的构建额度  
~~其实解决办法也有很多：比如单独开一个 posts 分支，到时把一切更改都完成了之后，再合并到 main 分支  
但是我选择了一个最懒惰的办法，就是不直接把图片放在 **D-blog** 项目下，而是使用自建图床(参考 “Cloudflare 带宽联盟实现 OSS 免回源流量费”)  
这样确实不错，甚至还能减少 **D-blog** 的项目文件~~
2026-8-14 **D-blog** 现在已经改成通过在Github Action部署然后推送到直传的EdgeOne和Cloudflare项目中  
但是我又意识到问题了：之前图片存在本地的时候，构建时会自动压缩图片，给出一个压缩版，用于一些首页之类的，但是换了图床就不能了，除非愿意花钱去用 CDN 或者 OSS 的图片处理  
这对电脑端的性能没什么影响(目前看来，Pagespeed insights的评分是 99 100 100 100)，但是对移动端性能可是毁灭性的打击  
目前打算就这样，后面再找找办法吧  

# 接入教程

很简单 其实只需要一个 *.pages.yml* 就行  
什么？ 你说你不知道？  
那也简单 直接让AI帮你写就行  
注意：上面说的教程都是实话 实在没啥教程好写 直接交给AI就行  

以下是 [D-blog](https://github.com/ououduck/D-blog "D-blog") 的 *.pages.yml* 文件 可供参考  

```yaml
# PagesCMS 配置 — D-blog 内容管理
# 文档: https://pagescms.org/docs/configuration/

content:
  # ── 文章集合 ──
  - name: posts
    label: 文章
    type: collection
    path: posts
    format: yaml-frontmatter
    filename: "{fields.id}.md"
    fields:
      - { name: id, label: URL标识, type: string, required: true }
      - { name: title, label: 标题, type: string }
      - { name: excerpt, label: 摘要, type: text }
      - { name: date, label: 发布日期, type: date }
      - { name: updatedAt, label: 更新日期, type: date }
      - name: category
        label: 分类
        type: select
        options:
          values: ["教程", "技术", "随笔", "分享", "其他"]
      - { name: tags, label: 标签, type: string, list: true }
      - { name: coverImage, label: 封面图链接, type: string }
      - { name: author, label: 作者, type: string }
      - { name: featured, label: 精选, type: boolean }
      - { name: featured-top, label: 精选置顶权重, type: number }
      - { name: series, label: 系列文章, type: boolean }
      - { name: series-name, label: 系列名, type: string }
      - { name: series-order, label: 系列顺序, type: number }
      - { name: draft, label: 草稿, type: boolean }
      - name: body
        label: 正文
        type: rich-text
        options:
          format: markdown
          switcher: true   # 允许切换源码模式编辑数学公式/Mermaid/嵌套图片链接

```

