## 一、Model组件
`Model` 组件是智能体的大脑。`langchain` 中的 `Model` 组件的地址为：`https://docs.langchain.com/oss/python/langchain/models`

**1、安装指令**
```
pip install langchain-openai
```

**2、使用**
```py
from langchain_openai import ChatOpenAI

ChatOpenAI(...)
```

**3、方法**
- **invoke**: 调用模型。
- **batch**：批量调用模型。
- **stream**：流式输出结构。

**4、常用参数**
- **model**：使用的模型。
- **temperature**：控制模型输出的随机性。
- **openai_api_key**: api密钥。
- **openai_api_base**：api接口请求地址。
...更多的参数可以参考文档。

## 二、智普 & deepseek接入
智普模型
```py
from dotenv import load_dotenv
from langchain.openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

load_dotenv()
llm = ChatOpenAI(
    temperature: 0.6,
    model: "GLM-5.3-Flash",
    openai_api_key: os.get("ZHIPU_API_KEY"),
    openai_api_base: os.get("ZHIPU_API_BASE")
)

template = PromptTemplate.from_template("你是一名{subject}领域的专家，下面请你回答如下问题:{question}")

prompt = template.invoke({
    "subject": "AI",
    "question": "AGI是什么？"
})

response = llm.invoke(template)
print(response.content)
```  
deepseek模型
```py
from dotenv import load_dotenv
from langchain.openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

load_dotenv()
llm = ChatOpenAI(
    temperature: 0.6,
    model: "deepseek-4.1-flash",
    openai_api_key: os.get("DEEPSEEK_API_KEY"),
    openai_api_base: os.get("DEEPSEEK_API_BASE")
)

template = PromptTemplate.from_template("你是一名{subject}领域的专家，下面请你回答如下问题:{question}")

prompt = template.invoke({
    "subject": "AI",
    "question": "AGI是什么？"
})

response = llm.invoke(template)
print(response.content)
```
`智普` 模型和 `deepseek` 模型两者模型的调用，都可以使用同一段代码。说明 `ChatOpenAI` 这个 `API`都是支持的，当开发的时候，涉及到换模型时，直接更改 `apikey` 和`base_url` 即可。

## 三、batch方法
`model` 支持 `invoke` 方法，表示当前只执行一个请求，如果想要执行多个请求，需要调用 `batch`方法。
以下以 `Deepseek` 为例。
```py
import os
from dotenv import load_dotenv
from langchain.openai import ChatOpenAI

load_dotenv()

llm = ChatOpenAI(
    "model"="deepseek-v4-pro",
    "tempertature": 0.6,
    "openai_api_key": os.getenv("DEEPSEEK_API_KEY"),
    "openai_api_base": os.getenv("DEEPSEEK_API_BASE")
)
template1 = "你是谁？"
template2 = "1 + 1 = ?"

response = llm.batch(
    [template1, template2]
)

print(len(response))
for item in response:
    print(response.content, end="\n\n")
```

## 四、stream 流失输出
```py
from langchain.openai import ChatOpenAI
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate 

load_env()

# 1、封装模板
template = PromptTemplate.from_template("你是一个专研于{topic}领域的专家，请你回答：{question}")

# 2、组装提示词
prompt = template.invoke({
    "topic": "AI",
    "question": "什么时AGI？"
})

# 3、创建模型对象
llm = ChatOpenAI(
    "model"="deepseek-v4-pro",
    "temperature"=0.6,
    "openai_api_key": os.getenv("DEEPSEEK_API_KEY"),
    "openai_api_base": os.getenv("DEEPSEEK_API_BASE")
)

# 4、调用
response = llm.stream(prompt)  # 这里的response就是一个可迭代对象

# 5、遍历
for chunk in response:
    print(chunk.content, flush=True, end="")
```