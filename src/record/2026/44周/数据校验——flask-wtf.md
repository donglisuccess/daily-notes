## 一、简介
`flask-wtf`: 主要是在对数据表单进行数据校验的 `python` 第三方库。官网地址：https://flask-wtf.readthedocs.io/en/1.2.x/

`wtforms`：Flask-WTF 是 WTForms 在 Flask 框架下的“适配器”和“增强包”。WTForms 是核心的表单库，而 Flask-WTF 让它能在 Flask 里用得更顺手、更安全。官网地址：https://wtforms.readthedocs.io/en/3.3.x/csrf/

> 从版本 0.9.0 开始，这种分工更加明确：Flask-WTF 不再包装 WTForms 的字段和验证器，你需要直接从 wtforms 导入字段（如 `from wtforms import StringField`），而从 flask_wtf 导入表单基类（`from flask_wtf import FlaskForm`）。

## 二、安装
```shell
pip install flask-wtf
```

## 三、在项目中集成
在项目中，是对项目接口进行数据校验，所以需要新建一个文件夹 `schema` 来保存数据校验信息的。
这里针对于 `/completions` 接口进行校验。

```py
from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Length

class CompletionsReq(FlaskForm):
    question = StringField(
        "question",
        validators=[
            DataRequired(message="用户问题是必填的"),
            Length(min=2, max=10, message="请输入字符长度在2到10之间")
        ]
    )
```

## 四、在接口中使用（伪代码）
```py
from internal.schema import CompletionReq

class Completions:
    req = CompletionReq()
    if not req.validate():
        return {"error": req.errors}
    ....
    ....
```

## 五、暂时关闭 flask-wtf 的 csrf 校验
由于这个 `flask-wtf` 的 `csrf` 配置是针对于 `flask` ，所以我们单独抽离出一个文件夹 `config`。

```py
class Config:
    def __init__(self):
        # 关闭wtf的csrf保护
        self.WTF_CSRF_ENABLED = False
```

在服务中增加配置：

```py
"""
HTTP服务
"""
from flask import Flask
from internal.router import Router
from config.config import Config

conf = Config()

class HTTP(Flask):
    def __init__(self, *args, router: Router, **kwargs):
        print("__name__", __name__)
        super().__init__(__name__, *args, **kwargs)
        router.register_router(self)
        self.config.from_object(conf)
```