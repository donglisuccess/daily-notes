## 一、为什么需要封装自动提交方法
我总结了两点原因：
- 解决了，每次对数据库进行操作都需要重复进行 `commit` 操作。 
- 方便了，如果每次对数据库操作失败了，自动帮我们进行回滚，不污染数据库。

## 二、封装方法
在 `pkg/sqlalchemy` 中进行封装
```py
from flask_sqlalchemy import SQLAlchemy as _SQLAlchemy
from contextlib import contextmanager

class SQLAlchemy(_SQLAlchemy):
    """继承原有的SQLAlchemy方法"""
    @contextmanager
    def auto_commit(self):
        try:
            yield
            self.session.commit()
        except Exception as e:
            raise e
```

## 三、将所有用到 `SQLAlchemy`的地方改为从 pkg.sqlalchemy 中引入

## 四、修改原有提交代码
以原有的 `service`的 `update_app` 为例，改为 `auto_commit` 的形式。
原有代码:
```py
    def update_app(self, id: uuid.UUID) -> App:
        app = self.get_app(id=id)
        app.name = "agents platform"
        self.db.session.commit()
        return app
```
改为：
```py
    def update_app(self, id: uuid.UUID) -> App:
        with self.auto_commit():
            app = self.get_app(id=id)
            app.name = "agents platform"
        return app
```

## 五、contextmanager的主要作用
`@contextmanager` 的核心作用就是用最少的代码，实现**最安全**、**最优雅的资源管理**、**异常处理**和**前后置逻辑控制**。