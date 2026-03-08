---
id: fix-c-drive-access-denied
title: 电脑C盘0x80070005打开C盘拒绝访问，打开exe提示网络错误，更改所有者卡死没反应的解决方法
excerpt: 解决Windows C盘权限异常、0x80070005错误、拒绝访问等问题的完整教程
date: 2026-01-30
category: 技术
tags:
  - C盘
  - 电脑异常
  - 权限异常
  - 0x80070005
  - C盘拒绝访问
readTime: 5分钟阅读
coverImage: /posts-img/1033012711.png
---

# 电脑C盘0x80070005打开C盘拒绝访问，打开exe提示网络错误，更改所有者卡死没反应的解决方法

## 教程步骤

### 1. 开机按shift进入界面，然后选择疑难解答

![1.png](/posts-img/1033012711.png)

### 2. 点击高级选项

![2.png](/posts-img/3860053228.png)

### 3. 点击启动设置

![3.png](/posts-img/1048792524.png)

### 4. 点击重启，然后按F4进入安全模式

![4.png](/posts-img/3326977194.png)

![4.1.png](/posts-img/1364159765.png)

### 5. 调出cmd，输入regedit然后回车，打开注册表编辑器

![5.png](/posts-img/3380821141.png)

### 6. 依次来到Policies/system

完整路径：

```
HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System
```

![6.png](/posts-img/2365001702.png)

### 7. 右侧修改consentPromptBehaviorAdmin和EnableLUA的值，都改成0

![7.png](/posts-img/3727143403.png)

![7.1.png](/posts-img/2692220662.png)

### 8. 重启进入电脑，选中C盘，右键属性-安全

![8.png](/posts-img/4092789719.png)

### 9. 点击高级-更改所有者

![9.png](/posts-img/3345193941.png)

### 10. 输入administrators，确定，然后保存退出

![10.png](/posts-img/1752829548.png)

### 11. 继续选中C盘右键属性-安全

![11.png](/posts-img/1988645623.png)

### 12. 点击编辑-添加

![12.png](/posts-img/3504424723.png)

### 13. 输入administrators，确定

![13.png](/posts-img/1887065490.png)

### 14. 输入Users，确定

![14.png](/posts-img/2344304557.png)

### 15. 最后然后一路无视错误提示一直点继续即可

![15.png](/posts-img/914644453.png)

---

## 总结

通过以上步骤，可以成功解决C盘权限异常的问题。主要原理是：

1. 在安全模式下临时关闭UAC（用户账户控制）
2. 重新设置C盘的所有者为administrators
3. 添加必要的用户组权限（administrators和Users）

完成后，C盘应该可以正常访问，exe文件也能正常运行了。

---

## 注意事项

- 修改系统权限需要谨慎操作
- 建议在操作前备份重要数据
- 如果问题依然存在，可能需要检查是否有病毒或恶意软件
- 完成修复后，建议重新启用UAC以保证系统安全

---

*最后修改：2026年01月30日*
