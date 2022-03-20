## 搭建环境步骤
```
1) 在根目录下创建bin目录
2) bin目录下创建www文件
3) 指定www这个文件的运行环境: `#! /usr/bin/env node`  顶部这行代码指定www文件以node环境运行
4) 在package.json中添加脚本:
    "bin": {
        "ms": "./bin/www"
    },
    指我们运行ms命令就是执行bin下的www文件
5) 执行`npm link`命令将bin脚本链接到全局 我们就可以在全局执行`ms`命令
```