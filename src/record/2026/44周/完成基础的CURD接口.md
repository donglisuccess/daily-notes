## 一、设计表结构
这里以一个应用为例：
在 `internal/models` 文件夹中的 `app.py` 文件中，编写相关表结构
```py
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy import (
    PrimaryKeyConstraint, 
    Index, 
    Column, 
    String, 
    Text, 
    DateTime)

class App:
    """应用表结构"""
    __tablename__ = "app" # 表名
    __table_args__ = (
        PrimaryKeyConstraint("id", "pk_app_id"),  # 主键，整张表中唯一值
        Index("idx_account_id", "account_id")     # 索引，方便检索数据
    )
    id=Column(UUID, default=uuid4, nullable=False)
    account_id=Column(UUID, nullable=False)
    name=Column(String(255), default="", nullable=False)
    icon=Column(String(255), default="", nullable=False)
    description=Column(Text, default="", nullable=False)
    update_at=Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    create_at=Column(DateTime, default=datetime.now, nullable=False)
```

## 二、创建服务层
本来想的是将操作数据库的相关逻辑放在 `handler` 层，但是想想有点不是很合理，`handler`层是用来完成对接口请求的处理，数据库操作当然耶斯
接口请求处理的一部分，但是并不是完全。所以我想的是将数据处理操作全部放到 `service` 中，如果 `handler` 中需要操作数据库，就调用 `service` 中的数据操作的`service`即可。

所以新建 `internal/service/app_service.py`
```py
import uuid

from flask_sqlalchemy import SQLAlchemy
from dataclass import dataclasses
from injector import inject
from internal.models import App

@inject
@dataclasses
class AppService:
    db: SQLAlchemy
    """操作数据库的service"""
    # 创建数据
    def create_app(self) -> App:
        app = App(name="llmops平台", account_id=uuid.uuid4(), description="llmops平台简介", icon="")
        self.db.session.add(app)
        self.db.session.commit()
        return app

    # 根据id查询数据
    def get_app(self, id: uuid.UUID) -> App:
        app = self.db.session.query(App).get(id=id)
        return app

    # 根据id修改数据
    def update_app(self, id: uuid.UUID) -> App:
        app = self.get_app(id=id)
        app.name = "agents platform"
        self.db.session.commit()
        return app

    # 根据id删除数据
    def delete_app(self, id: uuid.UUID) -> App:
        app = self.db.session.delete(id=id)
        self.db.session.commit()
        return app
```

## 三、handler层
```py
import uuid
from dataclass import dataclasses
from injector import inject

from pkg.response import success_message
from internal.service import AppService


@inject
@dataclasses
class AppHandler:
    app_service: AppService

    def create_app(self):
        data = self.app_service.create_app()
        return success_message(f"创建应用成功，id为{data.id}")
    
    def get_app(self, id: uuid.UUID):
        data = self.app_service.get_app(id=id)
        return success_message(f"应用获取成功，应用名称为{data.name}")

    def update_app(self, id: uuid.UUID):
        data = self.app_service.update_app(id=id)
        return success_message(f"应用修改成功，现应用名称为{data.name}")

    def delete_app(self, id: uuid.UUID):
        data = self.app_service.delete_app(id=id)
        return success_message(f"应用删除成功，删除应用的id为{data.id}")
```

## 四、router层处理
```py
class Router:
    ...
    bp.add_url_rule("/application/add", view_func=self.app_handler.create_app, methods=["GET"])
    bp.add_url_rule("/application/<uuid:id>", view_func=self.app_handler.get_app, methods=["GET"])
    bp.add_url_rule("/application/update/<uuid:id>", view_func=self.app_handler.update_app, methods=["POST"])
    bp.add_url_rule("/application/delete/<uuid:id>", view_func=self.app_handler.delete_app, methods=["POST"])
    ...
```

## 五、创建表结构
在项目启动的时候，应该先检查是否存在这个数据表，如果不存在，则先去创建。所以应该在 `db` 绑定在 `flask` 服务之后，应该取创建表。
```py
class Http(Flask):
    ...
    ...
    db.init_app(self)
    with self.app_context():
        _ = App()
        db.create_all()
    ...
    ...
```