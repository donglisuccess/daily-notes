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

### 1、选一列

```python
df["name"]
```

输出：返回 `Series`。

```shell
0    张三
1    李四
2    王五
Name: name, dtype: str
```

### 2、选多列

```python
df[["name", "age"]]
```

输出：返回 `DataFrame`，注意使用的是 **双中括号**。

```shell
	name	age
0	张三	18
1	李四	20
2	王五	22
```

### 3、按位置选行

选第 1 行：

```python
df.iloc[0]
```

输出：

```shell
name    张三
age     18
city    北京
Name: 0, dtype: object
```

选第 1 到第 3 行，不包括第 4 行。

```python```
df.iloc[0:3]
```

输出：

```shell
	name	age	city
0	张三	18	北京
1	李四	20	上海
```

### 4、按标签选择行列

```python
df.loc[0, "name"]
```

选第 0 行的 `name` 列。
输出：

```python
'张三'
```

```python
df.loc[0:1, ["name", "age"]]
```

输出：

```shell
	name	age
0	张三	18
1	李四	20
```

注意：`loc` 是标签切片，结束位置通常包含。

### 5、条件筛选

```python
df[df["age"] >= 19]
```

筛选 `age` 大于等于19 的行。

```python
df[(df["age"] >= 19) & (df["city"] == "上海")]
```

输出：

```shell
	name	age	city
1	李四	20	上海
```

注意：
`and` 要写成 `&`
`or` 要写成 `|`
每个条件要加括号

## 五、新增、修改、删除列

### 1、新增列

```python
df["is_adult"] = df["age"] >= 18
```

输出：

```shell
	name	age	city	is_adult
0	张三	18	北京	True
1	李四	20	上海	True
2	王五	22	广州1	True
```

### 2、基于已有列计算新列

```python
df["age_after_5_years"] = df["age"] + 5
```

输出：

```shell
	name	age	city	is_adult	age_after_5_years
0	张三	18	北京	True	23
1	李四	20	上海	True	25
2	王五	22	广州1	True	27
```

### 3、修改列

```python
df["city"] = df["city"].replace("北京", "北京市")
```

输出：

```shell
	name	age	city	is_adult	age_after_5_years
0	张三	18	北京市	True	23
1	李四	20	上海	True	25
2	王五	22	广州1	True	27
```

### 4、删除列

```python
df.drop(columns=["is_adult"])
```

### 5、删除行

```python
df.drop(index=[0])
```

## 六、缺失值处理，数据清洗的核心

真实数据一定有脏数据。
比如：

```python
data = {
    "name": ["张三", "李四", None],
    "age": [18, None, 22],
    "city": ["北京", "上海", None]
}

df = pd.DataFrame(data)
```

### 1、判断缺失值

```python
df.isna()
```

输出：

```shell
	name	age	city
0	False	False	False
1	False	True	False
2	True	False	True
```

每列缺失数量：

```python
df.isna().sum()
```

输出：

```shell
name    1
age     1
city    1
dtype: int64
```

### 2、删除缺失的值

```python
df.dropna()
```

输出：

```shell
	name	age	city
0	张三	18.0	北京
```

只看某列

```python
df.dropna(subset=["age"])
```

输出：

```shell
	name	age	city
0	张三	18.0	北京
2	NaN	22.0	NaN
```

### 3、填充缺失值

```python
df["age"] = df["age"].fillna(0)
```

输出：

```shell
	name	age	city
0	张三	18.0	北京
1	李四	0.0	上海
2	NaN	22.0	NaN
```

用平均值填充：

```python
df["age"] = df["age"].fillna(df["age"].mean())
```

输出：

```shell
	name	age	city
0	张三	18.0	北京
1	李四	20.0	上海
2	NaN	22.0	NaN
```

用默认文本填充：

```python
df["age"] = df["age"].fillna("未知")
```

输出：

```shell
	name	age	city
0	张三	18.0	北京
1	李四	未知	上海
2	NaN	22.0	NaN
```

## 七、重复值处理

### 1、查看重复行

```python
df.duplicated()
```

输出：

```shell
0    False
1    False
2    False
3     True
dtype: bool
```

### 2、删除重复行

```python
df.drop_duplicates()
```

输出：

```shell
 name	age	city
0	张三	18.0	北京
1	李四	NaN	上海
2	NaN	22.0	NaN
```

### 3、按某几列判断重复

```python
df.drop_duplicates(subset=["name", "city"])
```

### 4、保留最后一条

```python
df.drop_duplicates(subset=["name"], keep="last")
```

输出：

```shell
	name	age	city
1	李四	NaN	上海
2	NaN	22.0	NaN
3	张三	18.0	北京
```

## 八、数据类型转换

这是 pandas 深度的入口。很多 bug 都来自类型不对。

### 1、查看类型

```python
df.dtypes
```

输出：

```python
name        str
age     float64
city        str
dtype: object
```

### 2、转数字

```python
df["age"] = pd.to_numeric(df["age"])
```

输出：

```shell
	name	age	city
0	张三	18.0	北京
1	李四	NaN	上海
2	NaN	22.0	NaN
3	张三	18.0	北京
```

### 3、转时间

```python
from datetime import datetime
df['current_date'] = pd.to_datetime(datetime.now().date())
```

输出：

```shell
	name	age	city	current_date
0	张三	18.0	北京	2026-05-25
1	李四	NaN	上海	2026-05-25
2	NaN	22.0	NaN	2026-05-25
3	张三	18.0	北京	2026-05-25	
```

## 九、转字符串

```python
df["name"] = df["name"].astype("string")
```

输出：

```shell
	name	age	city	current_date
0	张三	18.0	北京	2026-05-25
1	李四	NaN	上海	2026-05-25
2	<NA>	22.0	NaN	2026-05-25
3	张三	18.0	北京	2026-05-25
```

## 十、排序

### 1、按一列排序

```python
df.sort_values("age")
```

输出：

```shell
	name	age	city	current_date
0	张三	18.0	北京	2026-05-25
3	张三	18.0	北京	2026-05-25
2	<NA>	22.0	NaN	2026-05-25
1	李四	NaN	上海	2026-05-25
```

### 2、倒序

```shell
df.sort_values("age", ascending=False)
```

输出：

```shell
name	age	city	current_date
2	<NA>	22.0	NaN	2026-05-25
0	张三	18.0	北京	2026-05-25
3	张三	18.0	北京	2026-05-25
1	李四	NaN	上海	2026-05-25
```

## 十一、groupby，pandas 的灵魂

如果你只能学透一个高级功能，那就是 `groupby`
你可以理解成 `SQL`：

```sql
SELECT city, AVG(age)
FROM users
GROUP BY city;
```

对应 `pandas`：

```python
df.group("city")["age"].mean()
```

### 1、示例数据

```python
data = {
    "city": ["北京", "北京", "上海", "上海", "广州"],
    "department": ["技术", "销售", "技术", "销售", "技术"],
    "salary": [20000, 12000, 22000, 15000, 18000]
}

df = pd.DataFrame(data)
```

### 2、按城市统计平均工资

```python
df.groupby("city")["salary"].mean()
```

输出：

```python
city
上海    18500.0
北京    16000.0
广州    18000.0
Name: salary, dtype: float64
```

### 3、多字段分组

```python
df.groupby(["city", "department"])["salary"].mean()
```

输出：

```shell
city  department
上海    技术            22000.0
      销售            15000.0
北京    技术            20000.0
      销售            12000.0
广州    技术            18000.0
Name: salary, dtype: float64
```

### 4、多个聚合指标

```python
df.groupby("city")["salary"].agg(["mean", "max", "min", "count"])
```

输出：

```shell
	mean	max	min	count
city				
上海	18500.0	22000	15000	2
北京	16000.0	20000	12000	2
广州	18000.0	18000	18000	1
```

### 5、自定义聚合

```python
df.groupby("city").agg(
    avg_salary=("salary", "mean"),
    max_salary=("salary", "max"),
    employee_count=("salary", "count")
)
```

输出：

```shell
	avg_salary	max_salary	employee_count
city			
上海	18500.0	22000	2
北京	16000.0	20000	2
广州	18000.0	18000	1
```

## 十二、merge / join / concat，表之间的关系

这个部分必须学深，因为它对应数据库里的表连接。

### 1、concat：上下拼接或左右拼接

上下拼接示例：

```python
# 第一份数据：10月份的销售记录
df1 = pd.DataFrame({'日期': ['10-01', '10-02'], '销售额': [1000, 1200]})

# 第二份数据：11月份的销售记录
df2 = pd.DataFrame({'日期': ['11-01', '11-02'], '销售额': [1500, 1300]})

# 上下拼接（axis=0 是默认值，可以不写）
df_all = pd.concat([df1, df2], axis=0)
```

输出：

```shell
	日期	销售额
0	10-01	1000
1	10-02	1200
0	11-01	1500
1	11-02	1300
```

### 2、左右拼接

当两份数据的行索引（比如都是按学号或日期排好的）能对齐时，就可以左右拼接：

```python
# 基础信息表
df_base = pd.DataFrame({'姓名': ['张三', '李四'], '年龄': [20, 22]})
# 成绩信息表
df_score = pd.DataFrame({'数学': [95, 88], '英语': [92, 90]})
# 左右拼接（指定 axis=1）
df_combined = pd.concat([df_base, df_score], axis=1)
```

输出：

```shell
	姓名	年龄	数学	英语
0	张三	20	95	92
1	李四	22	88	90
```

### 3、merge：按字段关联

用户表：

```python
users = pd.DataFrame({
    "user_id": [1, 2, 3],
    "name": ["张三", "李四", "王五"]
})

orders = pd.DataFrame({
    "order_id": [101, 102, 103],
    "user_id": [1, 2, 2],
    "amount": [99, 199, 299]
})

result = orders.merge(users, on="user_id", how="left")
```

输出：

```shell
	order_id	user_id	amount	name
0	101	1	99	张三
1	102	2	199	李四
2	103	2	299	李四
```

## 十三、字符串处理

```python
df["name"].str.len()
```

输出：

```shell
0    2
1    2
2    2
Name: name, dtype: int64
```

判断是否包含：

```python
df[df["name"].str.contains("张", na=False)]
```

输出：

```shell
name	age	city
0	张三	18	北京
```

去空格：

```python
df["name"] = df["name"].str.strip()
```

拆分：

```python
df["city"].str.split("北", expand=True)
```

## 十四、时间序列

时间数据非常常见。

```python
df["created_at"] = pd.to_datetime(df["created_at"])
```

提取年份

```python
df["year"] = df["created_at"].dt.year
```

提取月份：

```python
df["month"] = df["created_at"].dt.month
```

按月统计订单金额：

```shell
df.groupby(df["created_at"].dt.to_period("M"))["amount"].sum()
```

## 十五、apply、map、transform

这几个函数很多人乱用。你要分清楚。

### 1、map：通常用于 Series 映射

```python
df["gender_text"] = df["gender"].map({
    1: "男",
    2: "女"
})
```

### 2、apply：可以对行或列应用函数

```python
df["level"] = df["salary"].apply(
    lambda x: "高薪" if x >= 20000 else "普通"
)
```

对整行：

```python
df["desc"] = df.apply(
    lambda row: f"{row['name']}来自{row['city']}",
    axis=1
)
```

## 十六、完整实战：订单数据分析

### 1、构造数据

```python
import pandas as pd

orders = pd.DataFrame({
    "order_id": [1001, 1002, 1003, 1004, 1005, 1006],
    "user_id": [1, 2, 1, 3, 2, 4],
    "product": ["手机", "耳机", "电脑", "手机", "电脑", "耳机"],
    "price": [3999, 299, 5999, 3999, 5999, 299],
    "count": [1, 2, 1, 1, 1, 3],
    "city": ["北京", "上海", "北京", "广州", "上海", None],
    "created_at": [
        "2026-01-01",
        "2026-01-03",
        "2026-02-01",
        "2026-02-15",
        "2026-03-01",
        "2026-03-02"
    ]
})
```

输出：

```shell
	order_id	user_id	product	price	count	city	created_at
0	1001	1	手机	3999	1	北京	2026-01-01
1	1002	2	耳机	299	2	上海	2026-01-03
2	1003	1	电脑	5999	1	北京	2026-02-01
3	1004	3	手机	3999	1	广州	2026-02-15
4	1005	2	电脑	5999	1	上海	2026-03-01
5	1006	4	耳机	299	3	NaN	2026-03-02
```

### 2、查看数据

```python
orders.head(3)
orders.info()
orders.describe()
```

### 3、处理缺失城市

```python
orders["city"] = orders["city"].fillna("未知")
```

### 4、计算订单总价

```python
orders["amount"] = orders["price"] * orders["count"]
```

### 5、转时间

```python
df["created_at"] = pd.to_datetime(df["created_at"])	
```
