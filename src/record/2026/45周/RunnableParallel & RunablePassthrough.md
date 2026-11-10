## 一、RunnableParallel的作用
`RunnableParallel` 是 `langchain`中的 `runnable`对象中其中的一个类。主要的作用：
- **并行执行可执行链**。
- **在可执行链中做数据补齐**。

## 二、并行执行可执行链
`RunableParallel` 本身就是`runnable` 对象，所以在其本身就会有`invoke`方法。
下面实例：创建两个链，然后使用 `RunnableParallel` 并行执行。
```py
import os
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from langchain_core.output_parser import StrOutputparser
from langchain_core.runnable import RunnableParallel

load_dotenv()

# 1、创建提示词模板
joke_template = PromptTemplate.from_template("给我一个三十字左右的笑话，笑话的主题是：{topic}")
pome_template = PromptTemplate.from_template("给我一个三十字左右的诗歌，诗歌的主题是：{topic}")

# 2、创建模型
llm = ChatOpenAI(
    model="GLM-5.3-flash",
    openai_api_key=os.getenv("ZHIPU_API_KEY"),
    openai_base_url=os.getenv("ZHIPU_BASE_URL")
)

# 3、创建解析器
parser = StrOutputparser()

# 4、创建链
joke_chain = template | llm | parser
pome_chain = template | llm | parser

# 5、创建并行链
full_chain = RunnableParallel({
    "joke": joke_chain,
    "pome": pome_chain
})

# 6、调用
resp = full_chain.invoke({
    "topic": "程序员"
})

# 结果
print(resp)
# {"joke": "xxxx", "pome": "xxxx"}
```
上述示例中`RunnableParallel` 传入的是一个字典，其实也可以传入
```
RunnableParallel(joke=joke_chain, pome=pome_chain)
```

## 三、在可执行链中做数据补齐
由于`RunnableParallel` 是一个`runnable`的类，所以其可以执行参与 `|` 执行，类似于如下所示：
```py
RunnableParallel(....) | template | llm | parser
```
所以如下示例：
```py
import os
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from langchain_core.output_parser import StrOutputparser
from langchain_core.runnable import RunnableParallel

load_dotenv()

# 1、创建提示词模板
template = PromptTemplate.from_template("""
你是一个智能客服，请你基于下面的参考内容，回答用户问题：

<context>
{context}
</context>

用户问题：{query}
""")

# 2、创建模型
llm = ChatOpenAI(
    model="GLM-5.3-flash",
    openai_api_key=os.getenv("ZHIPU_API_KEY"),
    openai_base_url=os.getenv("ZHIPU_BASE_URL")
)

# 3、解析器
parser = StrOutputparser()

# 4、检索方法
def retrieval(query: str) -> str:
    return "我是小明"

# 5、创建链
chain = RunnableParallel({
    "context": lambda x: retrieval(x),
    "query": lambda x: x
}) | template | llm | parser

# 6、执行
resp = chain.invoke("我是谁？")

# 7、结果
print(resp)
```
这里使用 `匿名函数` 将用户输入的参数传递进入执行序列中。`RunnableParallel` 中包含的对象，就是在后续过程中出纳第给 `template`的。
**优化**：
由于 `runnable`对象左右两边有一个都可以执行将其转变为 `runnable` 对象，所以可以将 `RunnableParallel` 去掉，如下：
```py
{
    "context": lambda x: retrieval(x),
    "query": lambda x: x
} | template | llm | parser
```

## 四、RunnablePassthrough
`RunnablePassthrough` 也是 `runnable` 对象，其存在两个作用：
- 透传数据。
- 合并对象。

## 五、RunnablePassthrough透传数据
类似于：
```py
def RunnablePassthrough(str: Any) -> Any:
    return str
```
下面示例：
```py
import os
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from langchain_core.output_parser import StrOutputparser
from langchain_core.runnable import RunnableParallel, RunnablePassthrough

load_dotenv()

# 1、创建提示词模板
template = PromptTemplate.from_template("""
你是一个智能客服，请你基于下面的参考内容，回答用户问题：

<context>
{context}
</context>

用户问题：{query}
""")

# 2、创建模型
llm = ChatOpenAI(
    model="GLM-5.3-flash",
    openai_api_key=os.getenv("ZHIPU_API_KEY"),
    openai_base_url=os.getenv("ZHIPU_BASE_URL")
)

# 3、解析器
parser = StrOutputparser()

# 4、检索方法
def retrieval(query: str) -> str:
    return "我是小明"

# 5、创建链
chain = RunnableParallel({
    "context": retrieval,
    "query": RunnablePassthrough()
}) | template | llm | parser

# 6、执行
resp = chain.invoke("我是谁？")

# 7、结果
print(resp)
```

## 六、RunnablePassthrough合并对象
```py
chain = RunnablePassthrougt.assign(context=lambda x: retrieval(x["query"])) | template | llm | parser

chain.invoke({"query": "我是谁？"})
```