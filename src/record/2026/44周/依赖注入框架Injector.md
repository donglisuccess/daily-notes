## 一、什么是依赖注入。
**依赖注入：** 是一种设计模式。就是说一个A类，不应该有自己去创建另一个B类，而是由外部将B类传递进入供A类使用。

## 二、好处
- **解耦：**正常如果不使用**依赖注入**的话，此时就应该在A类中通过new B()去创建一个对象并使用。如果使用依赖注入，就直接将B类通过构造函数的形式传入接受。
- **方便单元测试：** 如果B类连接的是生产的数据库，我们想要测试A类，又不想连入生产从而造成生产风险，此时可以对B类进行Mock操作即可。

## 三、用法
安装：
```shell
pip install injector
```
引入：
```shell
from injector import inject, Injector
```
代码实现：
```python
class B:
    def run():
        print("i can run!")

class A:
   def __init__(self, b: B):
        self.b = b
   
   def play():
        self.b.run()

a = Injector()
ai = a.get(A)
ai.play()
```