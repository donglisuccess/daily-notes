## 一、CallbackHandler是什么？
`Callbackhandler` 是`langchain` 中的`callbacks`提供的支持日志追踪的**回调方法**。
其存在多种类型，例如：`StdOutputCallbackHandler`、`FileCallbackHandler`等，这类方法全部继承 `BaseCallbackHandler`。

## 二、StdOutputCallbackHandler
`StdOutputCallbackHandler`主要的功能就是将流程日志打印在**控制台**中。
```py
import os
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.callbacks import StdOutCallbackHandler

load_dotenv()
# 1、封装提示词模板
template = PromptTemplate.from_template("回答我的问题：{query}")

# 2、创建大模型
llm = ChatOpenAI(
    model="GLM-5.3-flash",
    openai_api_key=os.getenv("ZHIPU_API_KEY"),
    openai_api_base=os.getenv("ZHIPU_API_BASE_URL"),
)

# 3、输出解析器
parser = StrOutputParser()

# 4、创建链
chain = {
    "query": RunnablePassthrough()
} | template | llm | parser

# 5、调用链
resp = chain.invoke("我是谁？", config={"callbacks": [StdOutCallbackHandler()]})

print(resp)
```

## 三、FileCallbackHandler
`FileCallbackHandler` 是将调用链的日志放到指定的文件中，所以第一个参数为：`filename=xxx`，表示当前日志保存的路径。
```py
import os
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.callbacks import FileCallbackHandler

load_dotenv()
# 1、封装提示词模板
template = PromptTemplate.from_template("回答我的问题：{query}")

# 2、创建大模型
llm = ChatOpenAI(
    model="GLM-5.3-flash",
    openai_api_key=os.getenv("ZHIPU_API_KEY"),
    openai_api_base=os.getenv("ZHIPU_API_BASE_URL"),
)

# 3、输出解析器
parser = StrOutputParser()

# 4、链式调用
chain = {
    "query": RunnablePassthrough()
} | template | llm | parser

# 5、调用
resp = chain.invoke("你是谁？", config={"callbacks": [FileCallbackHandler(filename="./log.txt")]})

print(resp)
```

## 四、自定义回调
自定义回调需要继承`BaseCallbackHandler` 方法，然后重写指定的方法即可。
```py
import os
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.callbacks import BaseCallbackHandler
from uuid import UUID
from langchain_core.outputs import ChatGenerationChunk, GenerationChunk
from typing import Any

load_dotenv()
# 1、封装提示词模板
template = PromptTemplate.from_template("回答我的问题：{query}")

# 2、创建大模型
llm = ChatOpenAI(
    model="GLM-5.3-flash",
    openai_api_key=os.getenv("ZHIPU_API_KEY"),
    openai_api_base=os.getenv("ZHIPU_API_BASE_URL"),
)

# 3、输出解析器
parser = StrOutputParser()

# 4、链式调用
chain = {
    "query": RunnablePassthrough()
} | template | llm | parser

# 5、自定义类
class CustomOutputCallbackHandler(BaseCallbackHandler):
    def on_llm_new_token(
            self,
            token: str | list[str | dict[str, Any]],
            *,
            chunk: GenerationChunk | ChatGenerationChunk | None = None,
            run_id: UUID,
            parent_run_id: UUID | None = None,
            tags: list[str] | None = None,
            **kwargs: Any,
    ) -> Any:
        print("获取新的token:", token)

# 6、调用
resp = chain.stream("你是谁？", config={"callbacks": [CustomOutputCallbackHandler()]})

for item in resp:
    print(item, flush=True, end="")
```