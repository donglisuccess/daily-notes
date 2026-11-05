## 一、Prompt组件
`Prompt` 组件顾名思义，就是创建提示词的类，具体可以参考 https://reference.langchain.com/python/langchain-core/prompts 文档查看更多的 `Prompt` 的子类。

## 二、PromptTemplate
如下是使用 `PromptTemplate` 创建一个提示词模板
```py
from langchain_core.prompts import PromptTemplate

template = PromptTemplate.from_template("你是一个专研于{subject}的科学家")

prompt1 = template.format(subject="数学")  
# 返回的只是字符串
prompt1

prompt2 = template.invoke({
    "subject": "数学"
})
# 返回的只是字符串
prompt2.to_string()
# 返回是
prompt2.to_messages()
```

## 三、ChatPromptTemplate
`ChatPromptTemplate` 是针对于对话列表设置的提示词模板类。
```py
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.messages import AIMessage
from datetime import datetime

# 传递一个数组
template = ChatPromptTemplate.from_template([
    ("system", "你是一个专研于{subject}的专家, 目前时间为{now}"),
    # MessagePlaceholder就是消息占位符
    MessagesPlaceholder("histroy"),
    ("human", "请问什么是AI？")
]).partial({now: datetime.now()})
prompt = template.invoke({
    "subject": "人工智能",
    "history": [
        AIMessage("你好呀，我是你的AI助理")
    ]
})

# 输出拼接好的prompt
prompt
```

## 四、PromptTemplate组件与字符串拼接
```py
from langchain_core.prompts import PromptTemplate

template = PromptTemplate.from_template("你是一个专研于{subject}研究的专家") + ",你非常精通{topic}" + "\n下面由你帮我回答如下内容："

prompt = template.invoke({
    "subject": "AI",
    "topic": "LLM"
})

prompt.to_string()
```
`PromptTemplate实例`可以和字符串相加最终生成一个累加后的 `PromptTemplate`实例，其源码实现逻辑如下：
实现`__add__`方法，将字符串转化为`PromptTemplate`实体类，将前后两个的字符串内容进行累加，并且将参数进行累加。

## 五、复用提示模板
```py
from langchain_core.prompts import PromptTemplate

c = PromptTemplate.from_template("""
    {background}

    {example}

    {question}
""")

background_template = PromptTemplate.from_template("你是一个著名的企业家{name}, 你现在针对于疑问按照他的回答风格进行回答。")

example_template = PromptTemplate.from_template("""
    问题一：{question1}
    问题二：{answer1}
""")

question_template = PromptTemplate.from_template("问题: {question}")

background_prompt = background_template.invoke({
    "name": "雷军"
})
example_prompt = example_template.invoke({
    "question1": "你喜欢什么车?",
    "answer1": "小米su7"
})
question_prompt = question_template.invoke({
    "question": "你喜欢什么手机?"
})

question_prompt = question_template.invoke({
    "background": background_prompt,
    "example": example_prompt,
    "question": question_prompt
})

question_prompt
```