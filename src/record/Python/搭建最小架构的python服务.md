## 一、简述
本片技术碎碎念，主要是如何从 `0-1` 实现搭建的最小架构的 `python` 服务，主要从以下几步来总结：
- 创建处理器。
- 注册路由表。
- 创建服务。
- 将服务运行起来。

## 二、创建处理器。
处理器（handler）就是当请求走到路由时，用来处理路由并返回结果的方法。
一般在`internal.handler` 文件夹中进行编写，这里创建一个 `app_handler.py` 文件。
```py
class AppHandler:
    def ping(self):
        return {"ping": "pong"}
```
然后在 `__init__.py` 文件中通过 `__all__` 属性进行导出。
```py
from .app_handler import AppHandler

__all__=["AppHandler"]
```

## 三、注册路由
在 `internal` 文件夹下的 `router` 文件夹中保存是整个项目的路由。
```py
from flask import Flask, BluePrint
from internal.app_handler import AppHandler
from injector import inject

@inject
class Router:
    def __init__(self, app_handler: AppHandler):
        self.app_handler = app_handler


    def register_router(self, app: Flask):
        # 1 创建蓝图
        bp = Blueprint("llmops", __name__, url_prefix="")
        # 2 将url 绑定在控制器上
        bp.add_url_rule("/ping", view_func=self.app_handler.ping)
        # 3 将蓝图挂在到服务上
        app.register_blueprint(bp)
```
然后再 `__init__.py` 文件中导出
```py
from .router import Router

__all__ = ["Router"]
```

## 四、创建服务
服务一般创建在 `internal` 文件夹中的 `http` 文件夹中
```py
from flask import Flask
from internal.router import Router

class HTTP(Flask):
    def __init__(self, *args, router: Router,**kwargs):
        super().__init(self, *args, **kwargs)
        router.register_router(self)
```
在 `__init__` 中进行模块化导出。
```py
from .http import HTTP

__all__ = ["HTTP"]
```

## 五、将服务运行起来
在 `internal.app.app.py` 文件中主要写的是所有服务运行的逻辑。
```py
from internal.http import HTTP
from flask import Flask
from internal.router import Router
from injector import Injector

injector = Injector()
router = injector.get(Router)

app = HTTP(router)

if __name__ == "__main__":
    app.run(debug=true)
```
