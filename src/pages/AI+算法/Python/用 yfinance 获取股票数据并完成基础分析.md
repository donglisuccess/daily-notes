## 一、yfinance 是什么？
`yfinance` 是 `Python` 里一个非常常用的金融数据获取库。
它的核心作用是：**帮你从 Yahoo Finance 获取股票、ETF、指数、加密货币等金融数据。**
你可以把它理解成：
> 前端请求后端接口拿 JSON 数据，yfinance 就是帮你封装好了“请求 Yahoo Finance 数据接口”的 Python 工具。

它能拿到的数据主要包括：
| 数据类型        | 例子                      |
| ----------- | ----------------------- |
| 历史行情        | 开盘价、最高价、最低价、收盘价、成交量     |
| 分红数据        | dividend                |
| 拆股数据        | stock split             |
| 公司信息        | 市值、行业、PE 等部分基础信息        |
| 财务报表        | 利润表、资产负债表、现金流量表         |
| 多只股票数据      | AAPL、MSFT、TSLA 一次性下载    |
| 指数/ETF/加密货币 | `^GSPC`、`QQQ`、`BTC-USD` |

`yfinance` 官方文档也说明，它提供了访问 `Yahoo Finance API` 的方式，可以下载历史市场数据、访问 `ticker` 信息、缓存管理等。

## 二、安装 yfinance
在 `Jupyter` 里可以直接运行：
```python
!pip install yfinance
```
如果你已经安装过，但是遇到问题，可以升级：
```python
!pip install -U yfinance
```
导入：
```python
import yfinance as yf
import pandas as pd
import matplotlib.pyplot as plt
```
查看版本：
```python
import yfinance as yf
yf.__version__
```

## 三、踩坑：浏览器能访问，Python 请求却被 Yahoo 拒绝
在使用 `yfinance` 或直接请求 `Yahoo Finance` 接口时，我遇到了一个比较典型的问题：
浏览器中可以正常打开 `Yahoo Finance` 的接口，但是在 `Python` 中使用 `requests` 或 `curl_cffi` 请求时，却返回了 403，页面内容是 `Yahoo` 的错误页。
一开始我以为是 `yfinance` 版本问题，或者是 `curl_cffi` 没有配置好。后来排查后发现，真正的问题是：
浏览器请求走了本机代理，但是 `Python` 请求默认没有走代理。
我的浏览器能够正常访问，是因为浏览器或系统代理使用的是本机代理端口：
`127.0.0.1:33210`
但是 `Python` 脚本默认并不会自动使用浏览器代理，所以它是直接请求 `Yahoo Finance`。直连请求可能会被 `Yahoo` 拒绝，最终导致 403、429 或 `YFRateLimitError` 等问题
```python
import os

os.environ["HTTP_PROXY"] = "http://127.0.0.1:33210"
os.environ["HTTPS_PROXY"] = "http://127.0.0.1:33210"
```

## 四、第一个例子：获取苹果股票历史数据
我们先拿苹果公司的股票数据。
```python
import yfinance as yf
aapl = yf.Ticker("AAPL")
data = aapl.history(period="1y")
data
```
输出：
![alt text](./images/yfinance/1.png)
你会看到类似这样的表格：
| Date | Open | High | Low | Close | Volume | Dividends | Stock Splits |
| ---- | ---: | ---: | --: | ----: | -----: | --------: | -----------: |

几个核心字段你必须懂，详细解释可以看：[看懂开盘价、收盘价、成交量与分红拆股](#/notes/理财与投资/基础认知与模拟实战期/看懂开盘价、收盘价、成交量与分红拆股)。

| 字段           | 含义    |
| ------------ | ----- |
| Open         | 开盘价   |
| High         | 当天最高价 |
| Low          | 当天最低价 |
| Close        | 收盘价   |
| Volume       | 成交量   |
| Dividends    | 分红    |
| Stock Splits | 拆股    |
