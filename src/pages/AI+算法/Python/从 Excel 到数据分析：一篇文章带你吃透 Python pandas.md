## 一、你要先理解：pandas 到底解决什么问题？
pandas 主要解决的是：
> 把现实世界中的表格数据，变成 Python 里可清洗、可统计、可分析、可转换的数据结构。
它适合处理这些东西：
```shell
Excel
CSV
JSON
数据库查询结果
日志数据
订单数据
用户行为数据
财务数据
运营数据
爬虫数据
接口返回数据
```
你可以把 pandas 理解成：
```shell
pandas = Python 里的 Excel + SQL + 数据清洗工具 + 轻量分析引擎
```
但是注意，pandas 不是数据库，也不是大数据引擎。数据量特别大时，要考虑 Polars、DuckDB、Spark、数据库分批处理。

## 二、入门，先把 DataFrame 玩明白
### 1、安装 pandas
```shell
pip install pandas
```
### 2、导入 pandas
```shell
import pandas as pd
```
行业约定就是`pd`，不要自己起奇怪别名。
### 3、DataFrame 是什么？
最重要的结构是 `DataFrame`。
你可以把它理解成一张二维表：
```python
import pandas as pd

data = {
    "name": ["张三", "李四", "王五"],
    "age": [18, 20, 22],
    "city": ["北京", "上海", "广州"]
}

df = pd.DataFrame(data)

print(df)
```
输出：
```shell
  name  age city
0   张三   18   北京
1   李四   20   上海
2   王五   22   广州
```
这里有三个核心概念：
```shell
行 index：0, 1, 2
列 columns：name, age, city
值 values：表格里的具体数据
```
你要记住:
```shell
DataFrame = 多个 Series 组成的二维表
Series = 一列数据 + 索引
```
### 4、Series 是什么？
```python
s = pd.Series(["张三", "李四", "王五"])
s
```
输出：
```shell
0    张三
1    李四
2    王五
dtype: object
```
`Series` 可以理解成“一列数据”。
```shell
DataFrame 像 Excel 的一张表。
Series 像 Excel 里的一列。
Index 像每一行的行号，但它不一定只是 0、1、2，也可以是用户 ID、日期、订单号。
```
## 三、读取数据，这是 pandas 的入口
### 1、读取 CSV
```python
df = ps.read_csv("D:/project/python/users.csv", encoding="utf-8", sep=",")
df
```
输出：
```shell
	id	name	email	age	city
0	1	张三	zhangsan@example.com	28	北京
1	2	李四	lisi@example.com	31	上海
2	3	王五	wangwu@example.com	24	深圳
3	4	赵六	zhaoliu@example.com	35	广州
4	5	钱七	qianqi@example.com	29	杭州
```
### 2、读取 Excel
安装 `openpyxl`
```shell
pip install openpyxl
```
```python
df = pd.read_excel("users.xlsx")
```
指定工作表：
```python
df = pd.read_excel("users.xlsx", sheet_name="users")
df
```
读取所有工作表：
```python
sheets = pd.read_excel("users.xlsx", sheet_name=None)
print(sheets.keys())
```
输出：
```shell
dict_keys(['Users', 'Summary'])
```
### 3、写出文件
```python
df.to_excel("C:/Users/LENOVO/Desktop/users.xlsx", index=False)
```
`index=False` 很重要。否则 `pandas` 会把行索引也写进去，`Excel` 里多一列。

### 4、查看数据，先别急着处理
很多新手一上来就改数据，这是坏习惯。
正确流程是：
```shell
先看结构
再看类型
再看缺失
再看异常
最后再处理
```
**（1）、看前几行**
```python
df.head(2)
```
输出：
```shell
	name	age	city
0	张三	18	北京
1	李四	20	上海
```
**（2）、看后几行**
```python
df.tail()
```
输出：
```shell
	name	age	city
1	李四	20	上海
2	王五	22	广州1
```
**（3）、看维度**
```shell
df.shape()
```
输出：
```shell
(3, 3)
(行数, 列数)
```
**（4）、看列名**
```python
df.columns
```
输出：
```powershell
Index(['name', 'age', 'city'], dtype='str')
```
**（5）、看数据类型**
```python
df.dtypes
```
输出：
```shell
name      str
age     int64
city      str
dtype: object
```
**（6）、看整体**
```python
df.info()
```
输出：
```shell
<class 'pandas.DataFrame'>
RangeIndex: 3 entries, 0 to 2
Data columns (total 3 columns):
 #   Column  Non-Null Count  Dtype
---  ------  --------------  -----
 0   name    3 non-null      str  
 1   age     3 non-null      int64
 2   city    3 non-null      str  
dtypes: int64(1), str(2)
memory usage: 204.0 bytes
```
**（7）、看数值统计**
```python
df.describe()
```
输出：
```shell
age
count	3.0
mean	20.0
std	2.0
min	18.0
25%	19.0
50%	20.0
75%	21.0
max	22.0
```
看所有类型：
```python
df.describe(include="all")
```
## 四、行列选择，这是 pandas 的基本功
`pandas` 最容易让人混乱的地方就是选数据。
