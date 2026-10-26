## 一、安装python-dotenv
```shell
pip install python-dotenv
```

## 二、在入口文件中引入
```py
from dotenv import load_dotenv

load_dotenv()
```

## 三、load_dotenv常用参数
**dotenv_path**: 指定环境变量的路由，默认去查找当前项目的 `.env`文件。

## 四、获取环境变量的值
```py
import os

api_key = os.getenv("ZHIPU_API_KEY")
```