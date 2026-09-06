---
title: Tmux 终端复用美化指南
date: 2024-05-15
tag: Linux
summary: 让你的终端既高效又美观，打造舒适的开发环境。
ai_summary: 基于 gpakosz/.tmux 配置的速查手册：分屏与窗格操作、会话管理、搜索与 Vim 风格复制模式、resurrect 环境保存恢复，以及 tmux 内部剪切板与系统剪切板的打通方法。
---

# tmux 使用指南

tmux 是终端复用神器，一个终端窗口里开出无数个分屏和会话，断开连接也不怕丢失工作现场。用熟了之后，你会觉得没有 tmux 的终端简直不完整。

本文基于 [gpakosz/.tmux](https://github.com/gpakosz/.tmux) 配置整理。

## 基础概念

tmux 的所有快捷键都需要先按一个**前缀键**（prefix），默认是 `ctrl + b`，也可以配置为 `ctrl + a`。下文统一简称 `prefix`。

操作方式：先按下 prefix 组合键，松开后再按对应的指令键。

> 小技巧：可以用 gnome-tweaks 把 CapsLock 映射为 Ctrl，这样按前缀键就轻松多了。

## 分屏与窗格操作

窗格（pane）是 tmux 最常用的功能，把一个窗口切成多块各干各的。

| 快捷键 | 说明 |
| :--- | :--- |
| `prefix -` | 上下分屏 |
| `prefix _` | 左右分屏 |
| `prefix h / j / k / l` | 切换到 左 / 下 / 上 / 右 的窗格（Vim 风格） |
| `prefix H / J / K / L` | 向 左 / 下 / 上 / 右 调整窗格边界 |
| `prefix <` / `prefix >` | 与左侧 / 右侧窗格交换位置 |
| `prefix z` | 最大化 / 还原当前窗格 |
| `prefix +` | 将当前窗格提升为独立窗口 |
| `prefix q` | 显示窗格编号 |
| `prefix m` | 开启 / 关闭鼠标模式 |

## 会话管理

会话（session）是 tmux 的顶层单位，断开连接后会话依然存活。

| 快捷键 | 说明 |
| :--- | :--- |
| `prefix d` | 脱离当前会话（会话继续在后台运行） |
| `prefix s` | 打开会话选择界面（上下选会话，左右展开窗口，回车切换） |
| `prefix ctrl+c` | 创建并进入新会话 |
| `prefix :` | 进入 tmux 命令行 |

## 搜索与复制

| 快捷键 | 说明 |
| :--- | :--- |
| `prefix /` | 终端内搜索（支持正则），`n` / `N` 上下跳转结果 |
| `prefix enter` 后 `/` | 先进入复制模式再搜索，可全局检索当前终端内容 |
| `Escape` | 退出搜索 / 复制模式 |

### 复制模式（copy-mode-vi）

进入复制模式后，操作方式和 Vim 一致：

| 按键 | 说明 |
| :--- | :--- |
| `v` | 开始选择（可视模式） |
| `ctrl+v` | 切换块选择模式 |
| `H` | 跳到行首 |
| `L` | 跳到行尾 |
| `y` | 复制选中内容 |
| `Escape` | 取消操作 |

## 插件快捷键

| 插件 | 快捷键 | 说明 |
| :--- | :--- | :--- |
| tmux-resurrect | `prefix ctrl+s` | 保存当前环境 |
| tmux-resurrect | `prefix ctrl+r` | 恢复保存的环境 |
| tmux-yank | `prefix y` | 复制内容到系统剪切板 |
| -- | `prefix u` | 更新插件 |
| -- | `prefix r` | 重新加载配置 |

## 常用命令

在 tmux 环境中，按 `prefix :` 进入命令模式，输入以下命令：

| 命令 | 说明 |
| :--- | :--- |
| `kill-session -t 名称` | 干掉指定会话（kill-window、kill-pane 同理） |
| `list-sessions` | 列出所有会话（list-windows、list-panes 同理） |
| `swap-window -t 目标` | 交换窗口位置 |
| `rename-session -t 新名` | 重命名会话 |
| `detach` | 脱离当前会话 |

> 命令支持 Tab 补全，输入 `kill-` 或 `list-` 后按 Tab 看看有哪些可用的。

在普通终端中，直接用 `tmux` 命令操作：

| 命令 | 说明 |
| :--- | :--- |
| `tmux attach-session -t 会话名` | 连接到指定会话 |
| `tmux ls` | 列出所有会话 |
| `tmux new -s 名称` | 创建一个有名字的新会话 |

## 剪切板小贴士

tmux 有自己的内部剪切板，和系统剪切板是隔开的。要打通它们，可以在配置中加一行：

```bash
set -g @override_copy_command "xclip -selection clipboard"
```

开启鼠标模式后的选中规则：

- `shift` + 鼠标选中 -- 走系统 primary 剪切板
- 直接鼠标选中 -- 走 tmux 内部剪切板

Linux 下的两套剪切板：

- `ctrl+v` 粘贴的是**标准剪切板**（clipboard）
- 鼠标中键粘贴的是 **primary 剪切板**

## 实用小技巧

查看当前所有键绑定：

```bash
tmux list-keys
```

按关键词过滤，比如查看鼠标相关的绑定：

```bash
tmux list-keys | grep Mouse
```
