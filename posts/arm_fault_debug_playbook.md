---
title: Cortex-M Fault 排查实战：从 CFSR/BFSR 到定位闭环
date: 2026-02-15
tag: 嵌入式
summary: 用一套可复用的流程，快速定位 Cortex-M 上的总线错误和异常现场。
ai_summary: 拆解 CFSR/BFSR/BFAR 寄存器关系，区分精确与非精确总线错误的定位思路，给出五步排查流程和异常现场打印模板，并用「一备一 + 参考硬件 + 最小 demo」原则避免无效调试。
---

# Cortex-M Fault 排查实战

嵌入式调试里最容易耗时间的，不是“不会修”，而是“定位太慢”。  
这篇记录我在 Cortex-M 项目里常用的一套 Fault 排查路径，重点围绕 `CFSR/BFSR/BFAR`。

## 1. 先明确寄存器关系

`CFSR` 是一个 32 位状态寄存器，按位段拆成三部分：

- `CFSR[7:0]`：`MMFSR`（MemManage Fault）
- `CFSR[15:8]`：`BFSR`（BusFault）
- `CFSR[31:16]`：`UFSR`（UsageFault）

很多工程会直接按字节读取 `0xE000ED29`，本质上就是读 `BFSR`。

## 2. BFSR 最常用位

- `IBUSERR`：取指总线错误
- `PRECISERR`：精确数据总线错误（常见、最好定位）
- `IMPRECISERR`：非精确数据总线错误（上报有延迟）
- `UNSTKERR`：异常返回出栈错误
- `STKERR`：异常进入压栈错误
- `BFARVALID`：`BFAR` 地址有效

经验上最关键的是 `PRECISERR` 和 `IMPRECISERR` 的区分。

## 3. 精确错误 vs 非精确错误

### `PRECISERR`

- 出错指令通常可以直接从堆栈里的 `PC` 对上
- `BFAR` 常常可用
- 适合“断点 + 反汇编 + 变量检查”快速闭环

### `IMPRECISERR`

- 错误可能晚报
- 当前 `PC` 不一定是根因指令
- 常见于写缓冲、总线仲裁或外设延迟反馈

遇到 `IMPRECISERR` 时，不要只盯当前行代码，要沿着“最近写操作 + 外设访问路径”往前追。

## 4. 建议的定位流程

1. 先抓现场：`CFSR/HFSR/BFAR/MMFAR` + `stacked PC/LR`
2. 判断是否 `BFARVALID`
3. 若是 `PRECISERR`：直接对 `PC` 反汇编，定位访问地址
4. 若是 `IMPRECISERR`：回溯最近总线写路径，重点查 DMA、外设寄存器写入、时序
5. 结合参考工程验证：同一外设访问序列在官方 demo 板跑一遍

## 5. 现场打印最小模板

```c
void fault_dump(void)
{
    volatile unsigned int cfsr = SCB->CFSR;
    volatile unsigned int hfsr = SCB->HFSR;
    volatile unsigned int bfar = SCB->BFAR;
    volatile unsigned int mmfar = SCB->MMFAR;

    rt_kprintf("CFSR=0x%08X HFSR=0x%08X BFAR=0x%08X MMFAR=0x%08X\n",
               cfsr, hfsr, bfar, mmfar);
}
```

这段不复杂，但对“第一次定位速度”影响很大，建议固定进异常处理链路。

## 6. 避免无效调试

我自己的规则是：  
**调试目标一定一备一，必须有参考硬件和最小参考软件。**

这样出问题时可以很快回答两个问题：

- 是我的代码问题，还是硬件状态问题？
- 是系统性问题，还是工程局部配置问题？

## 结语

Fault 调试的核心不是记住多少位定义，而是建立可重复的定位流程。  
寄存器给你“症状”，流程帮你找到“病因”。
