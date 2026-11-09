## 一、Outputparser组件
`OutputParser` 组件是用来规范模型输出结果的组件。那么为啥需要这样一个组件呢？**是因为大模型的输出结果是不可控的，所以我们无法直接使用模型输出结果，所以就需要在使用之前将输出结果进行规范化输出。所以就需要 OutputParser组件。**

## 二、StrOutputParser 类
`StrOutputParser` 类是将输出结果转化为字符串的类。文档地址为：`https://reference.langchain.com/python/langchain-core/output_parsers/string/StrOutputParser`
**使用案例**
```py
import os
from langchain.openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv

load_dotenv()

# 1、创建模板
template = PromptTemplate.from_template("{query}")

# 2、创建提示词
prompt = template.invoke({
    "query": "什么是AGI"
})

# 3、创建llm
llm = ChatOpenAI(
    model="GLM-5.3-flash",
    openai_api_key=os.getenv("ZHIPU_API-KEY"),
    openai_api_base=os.getenv("ZHIPU_API_BASE")
)

# 4、创建str 解析器
parser = StrOutputParser()

# 5、执行结果
# parse方法调用，模型返回什么，parse调用后也返回什么
print(parser.parse(llm.invoke(prompt)))
# invoke方法调用，模型返回AIMessage，invoke会返回content中的内容
print(parser.invoke(llm.invoke(prompt)))
```

## 三、JsonOutputParser 类
```py
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Filed
from langchain_core.output_parsers import JsonOutputParser

class Joke(BaseModel):
    setup:str=Filed(description="笑话的铺垫问题")
    punchline:str = Filed(description="笑话的包袱")

parser = JsonOutputParser(pydantic_object=Joke)

# 1、封装模板
template = ChatPromptTemplate.from_messages([
    ("system", "你是一个AI机器人，请你根据用户需求回答问题"),
    ("human", "{instrution}\n\n{query}")
]).partial(instrution=parser.get_format_instructions())


# 2、封装提示词
response = template.invoke({
    "query": "给我讲一个关于程序员的笑话"
})

# 3、输出
print(parser.invoke(response)) # 返回的是一个json数据
```

## 四、详解JsonOutputParser源码
其实解析器其实都是转化为`提示词`交给模型的。就以`JsonOutputparser` 为例，通过创建`Joke`实体类，传给`pydantic_object`，然后通过`get_format_instructions`拿到
这个实例对象的提示词，通过`f-string`得到提示词字符串。代码如下：
```py
    def get_format_instructions(self) -> str:
        """Return the format instructions for the JSON output.

        Returns:
            The format instructions for the JSON output.
        """
        if self.pydantic_object is None:
            return "Return a JSON object."
        # Copy schema to avoid altering original Pydantic schema.
        schema = dict(self._get_schema(self.pydantic_object).items())

        # Remove extraneous fields.
        reduced_schema = schema
        if "title" in reduced_schema:
            del reduced_schema["title"]
        if "type" in reduced_schema:
            del reduced_schema["type"]
        # Ensure json in context is well-formed with double quotes.
        schema_str = json.dumps(reduced_schema, ensure_ascii=False)
        return JSON_FORMAT_INSTRUCTIONS.format(schema=schema_str)
```