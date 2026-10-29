## 一、依赖包安装
在 `python` 中可以使用 `pytest` 可以对python代码进行测试。
官网地址：https://docs.pytest.org/en/stable/

安装：
```shell
pip install pytest
```

## 二、编写测试用例
在 `test` 文件夹中编写所有测试用例。针对于接口的 `handler` 进行处理，所以需要在 `test` 文件夹中新增文件：
`internal/handler/app_handler_test.py` 这个 `app_handler_test.py` 主要是对 `app_handler.py` 文件进行测试的。
文件名、类名、方法名其实都是固定格式的，后面有`pytest.ini` 主要针对于 `pytest`测试配置的。

**创建conftest.py**
这个文件是固定的文件格式。既然要测试接口，肯定需要 `client` 进行接口请求的，这个文件的主要就是对 `app` 注入一些测试配置。
```py
import pytest

from app.app import app

# 创建client用于接口测试
@pytest.fixture  # 这个的主要作用就是，后面有方法需要用到这个client的时候，只需要传入client就可以直接使用。
def client():
    # 告诉app服务当前是test
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client
```
`app_handler_test.py` 
```py
from pkg.response import HttpCode

class AppHandlerTest:
    def test_completions(self, client):
        resp = client.post("/completions", json={"question": "介绍下你自己？"})
        assert resp.status_code == 200
        assert resp.json.get("code") == HttpCode.SUCCESS
```
上面是一种正常请求的场景。但是除了这种场景外，还应该存在另外`error`场景。

```py
from pkg.response import HttpCode

class AppHandlerTest:
    def test_completions(self, client):
        resp = client.post("/completions", json={"question": None})
        assert resp.status_code == 200
        assert resp.json.get("code") == HttpCode.VALIDATION_ERROR
```

## 三、优化测试用例
上述两块测试用例的代码，有很多冗余，下面将两者合并。
```py
import pytest

from pkg.response import HttpCode

@pytest.mark.parametrize("query", [None, "你好，你是谁？"])
class AppHandlerTest:
    def test_completions(self, query, client):
        resp = client.post("/completions", json={"question": query})
        assert resp.status_code == 200
        if query is None:
            assert resp.json.get("code") == HttpCode.VALIDATION_ERROR
        else:
            assert resp.json.get("code") == HttpCode.SUCCESS
```
这里使用 `pytest.mark.parametrize` 可以多个参数传入。

## 四、执行指令参数
`-v`: 显示出详细的日志信息。
`-s`: 显示出代码执行过程中的打印。
执行指令：
```shell
pytest -v -s
```
指定对应的方法执行：
```shell
pytest -v -s ./test/internal/handler/app_handler_test.py::AppHandlerTest::test_completions
```

## 五、配置文件
在项目根目录中可以编写 `pytest.ini` 这个文件包含一些配置文件：
```ini
# 表示当前是pytest的配置文件
[pytest]

# 在执行pytest指令时会生成缓存文件，默认会放在根目录下的.pytest_cache文件夹中，cache_dir可以指定缓存文件存放的目录。
cache_dir=tmp/.pytest_cache

# 默认携带指令，一般在执行测试用例的时候使用指令为：pytest -v -s，通过添加addopts就可以省略-v -s，执行pytest时默认携带。
addopts=-v -s

# pytest检索的测试用例的文件名
python_files=test_*.py *_test.py

# 测试类的名称限定
python_classes=Test*

# 限定python测试用例的方法名
python_function=test_* *_test
```
