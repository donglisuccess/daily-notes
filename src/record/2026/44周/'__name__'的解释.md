## 一、运行在当前模块
如果运行在当前模块下，`__name__` 则表示 `__main__`。

## 二、在其他包资源引用
如果被其他包资源通过 `import` 引用时，则 `__name__` 则就表示当前的模块名。

例如如下的文件结构：
```shell
myproject/
├── main.py
└── internal/
    ├── __init__.py
    ├── http.py      ← 定义 HTTP 类
    └── router.py
```
### 1、在项目根目录下执行 `python main.py`
`internal/http.py` 里的 `__name__` = `internal.http`

`main.py` 里的 `__name__` 为 `__main__`

### 2、把 `internal` 作为根，`cd internal && python http.py`
此时 `__name__` 就是 `__main__`

### 3、执行 `python -m internal.http`
此时 `__name__` 就是 `__main__`