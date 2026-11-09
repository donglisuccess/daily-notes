## 一、LCEL
`LCEL` 的全称是 `langchain expression language`就是 `langchain`表达式语言。
**目前遇到的问题是**：
`template`、`llm`、`parser` 都是执行完当前结果然后将结果传入到下一个方法中调用。这样过于麻烦了，容易出现回调地狱的情况。如下：
```py
parser.invoke(
    llm.invoke(
        template.invoke(
            {
                "query": "你好？"
            }
        )
    )
)
```
如上述代码所示，这样编写代码非常混乱。

## 二、手动封装 Chain类
按照上述的写法，太过于繁琐，此时采用手动封装一个 `Chain` 类，让其可以串行调用，当执行一个后，将当前结果传递给下一个。代码如下：
```py
import os
from langchain_core.prompts import ChatPromptTemplate
from langchain.openai import ChatOpenAI
from dotenv import load_dotenv
from langchain_core.output_parsers import StrOutputParser
from typing import Any

load_dotenv()

template = ChatPromptTemplate.from_messages([
    ("system", "你好，请回答用户问题"),
    ("human", "{query}")
])

llm = ChatOpenAI(
    model="GLM-5.3-flush",
    openai_api_key=os.get("ZHIPU_API_KEY"),
    openai_base_url=os.get("ZHIPU_BASE_URL")
)

parser = StrOutputParser()

# 封装Chain类
class Chain:
    def __init__(self, arr: Any):
        self.arr = arr

    def invoke(self, input: Any):
        for item in self.arr:
            input = item.invoke(input)
        return input

chain = Chain([template, llm, parser])
resp = chain.invoke({
    "query": "你好，你是？"
})
print(resp)
```

## 三、LCEL使用
```py
import os
from langchain_core.prompts import ChatPromptTemplate
from langchain.openai import ChatOpenAI
from dotenv import load_dotenv
from langchain_core.output_parsers import StrOutputParser
from typing import Any

load_dotenv()

template = ChatPromptTemplate.from_messages([
    ("system", "你好，请回答用户问题"),
    ("human", "{query}")
])

llm = ChatOpenAI(
    model="GLM-5.3-flush",
    openai_api_key=os.get("ZHIPU_API_KEY"),
    openai_base_url=os.get("ZHIPU_BASE_URL")
)

parser = StrOutputParser()

chain = template | llm | parser

resp = chain.invoke({
    "query": "你好，你是？"
})

print(resp)
```