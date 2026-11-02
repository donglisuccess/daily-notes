## 一、ORM概念
orm的英文全程是`Object-Relational-Mapping` 就是对象关系映射。就是说将数据库这种抽象的概念和编程思想做一些具体的映射关系。
```
数据库表  <=> 实体类
行数据    <=> 实例化对象
列数据    <=> 实例化对象属性值
...      <=> ...
```

### 1、ORM的好处
- 提高开发效率
- 提高代码的可维护性、安全性
- 减少重复 SQL
- 方便对象化操作数据库。

### 2、ORM的坏处
- 隐藏 SQL 细节
- 复杂查询不方便
- 容易产生性能问题
- 需要额外学习成本，而且不能替代数据库和 SQL 基础

## 二、在项目中集成Sqlalchemy
### 1、安装包
```shell
pip install flask-sqlalchemy psycopg2
```
`flask-sqlalchemy` 的主要作用就是将 `python` 代码转化为 `sql` 语句。
`psycopg2` 的主要作用就是执行前面转化的 `sql`

### 2、封装database_extension.py
因为 `sqlalchemy` 是一个扩展，所以应该将其写在 `internal/extensions` 文件夹下，新建一个 `database_extension.py` 表示数据库扩展。
```py
from flask_sqlalchemy import SQLAlchemy

# 数据库对象实例化
db = SQLAlchemy()
```
在 `__init__.py` 文件中进行导出：
```
from .database_extension import db

__all__ = ["db"]
```

### 3、封装配置文件
在 `.env` 环境变量中编写编写关于数据库的一些配置。
```py
# 数据库连接地址
SQLALCHEMY_DATABASE_URI=""
# 是否打印执行的sql语句，方便排查问题
SQLALCHEMY_ECHO=True
# 数据库连接池的最大数量
SQLALCHEMY_POOL_SIZE=10
# 数据库连接最长时间
SQLALCHEMY_POOL_RECYCLE=3600
```
配置的默认值：
```py
FLASK_CONFIG_DEFAULT = {
    "SQLALCHEMY_DATABASE_URI": "",
    "SQLALCHEMY_ECHO": True,
    "SQLALCHEMY_POOL_SIZE": 10,
    "SQLALCHEMY_POOL_RECYCLE": 3600
}
```
这些都是 `flask` 中的配置，所以需要在将其绑定在 `flask` 实例中，下面是
```py
import os 

from .config_default import FLASK_CONFIG_DEFAULT

def _get_env(key: str) -> str:
    return os.getenv(key, FLASK_CONFIG_DEFAULT.get(key))
# 如果获取的是布尔值
def _get_env_boolean(key: str) -> bool:
    value = _get_env(key).lower() 
    return value == "true" if value is not None else False

# 伪代码
class Config:
    def __init__(self):
        self.SQLALCHEMY_DATABASE_URI = _get_env("SQLALCHEMY_DATABASE_URI")
        self.SQLALCHEMY_ECHO = _get_env_boolean("SQLALCHEMY_ECHO")
        self.SQLALCHEMY_ENGINE_OPTIONS = {
            "pool_size": _get_env("SQLALCHEMY_POOL_SIZE"),
            "pool_recycle": _get_env("SQLALCHEMY_POOL_RECYCLE")
        }
```
`SQLALCHEMY_DATABASE_URI`的数据格式为：`postgresql@username:password://ip:port/database?client_encoding=utf8`

### 4、将其作为依赖注入到Http服务中
```py
from flask_sqlalchemy import SQLAlchemy

# 伪代码
class Http(db: SQLAlchemy):
    db.init_app(self)
```

### 5、在app.py文件中，绑定已经创建的db实例
```py
from inject import Injector, Module
from flask_sqlalchemy import SQLAlchemy
from internal.extension import db

class ExtensionModule(Module):
    def configure(self, binder: Binder):
        binder.bind(SQLAlchemy, to=db)

injector = Injector([ExtensionModule])

app = Http(db=injector.get(SQLAlchemy))
```

