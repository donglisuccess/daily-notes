## 一、BaseChatMessageHistory类
这个类主要用作历史会话保存的基类，它是有个抽象类。
```py
class BaseChatMessageHistory(ABC):
    ....
```
而且在`2.0.0`版本已经废弃了。
```py
@deprecated(
    since="1.6.4",
    removal="2.0.0",
    addendum=(
        "See the short-term memory documentation for recommended alternatives: "
        "https://docs.langchain.com/oss/python/langchain/short-term-memory"
    ),
)
```
这里的从`1.6.4` 开始准备废弃，`2.0.0`版本开始真正移除。

## 二、InMemoryChatMessageHistory 类
`InMemoryChatMessageHistory`类是基于`BaseChatMessageHistory`创建的子类。 
如下是一个示例：
```py
import os
from dotenv import load_dotenv
from openai import OpenAI
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.messages import get_buffer_string # 将消息转化为字符串

load_dotenv()

history = InMemoryChatMessageHistory()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url=os.getenv("DEEPSEEK_BASE_URL")
)

while True:
    query = input("human:")

    prompt = f"""
        你是一个AI助理，请你回答用户问题：
        
        历史消息：
        {get_buffer_string(history.messages)}
    """

    response = client.chat.completions.create(
        model="deepseek-flash",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": query}
        ],
        stream=True
    )

    print("AI:", end="")
    content = ""
    for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            content += chunk.choices[0].delta.content
        
    history.add_user_message(query)
    history.add_ai_message(query)
```
这里是将消息放在`内存`中，每一次都会通过提示词将消息放到提示词中，然后发送给llm。

## 三、FileChatMessageHistory
`FileChatMessageHistory` 其实是将历史记录放在文件中，这个类在 `langchain_core` 核心里面其实并没有，而是在`langchain_community` 这个包中进行的拓展，其内部
其实也是继承了`BaseChatMessageHistory`，如下是其示例。
```py
import os
from dotenv import load_dotenv
from openai import OpenAI
from langchain_community.chat_message_histories import FileChatMessageHistory
from langchain_core.messages import get_buffer_string, AIMessage, HumanMessage

load_dotenv()

history = FileChatMessageHistory(file_path="./FileChatMessageHistory.txt")

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url=os.getenv("DEEPSEEK_BASE_URL")
)

while True:
    query = input("human:")

    prompt = f"""
        你是一个AI智能体，下面帮用户回答问题：

        {}
    """

    response = client.chat.completions.create(
        model="deepseek-flash",
        messages=[
            {
                "role": "system", 
                "content": prompt,
            },
            {
                "role": "user",
                "content": query
            }
        ]
    )

    print("ai:", end="")
    content = ""
    for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            content += chunk.choices[0].delta.content

    history.add_message(HumanMessage(query))
    history.add_message(AIMessage(content))
```
