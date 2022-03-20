const path = require("path");
const fs = require("fs").promises;

async function renderFile(filePath, data) {
  // 读取模板HTML文件
  let tmplStr = await fs.readFile(filePath, "utf-8");
  // 构建一个函数体
  // 定义 let str = '';
  let myTemplate = `let str = ''\r\n`;
  // 将解析出的HTML放在with函数中
  myTemplate += "with(obj){";
  // str内容是模板字符串
  myTemplate += "str+=`";
  // 将<%= 变量 %>替换成 ${变量} 的形式
  tmplStr = tmplStr.replace(/<%=(.*?)%>/g, function () {
    return "${" + arguments[1] + "}";
  });
  // 将<% 语句 %> 替换成 语句 的形式 并拼接到myTemplate上
  myTemplate += tmplStr.replace(/<%(.*?)%>/g, function () {
    return "`\r\n" + arguments[1] + "\r\nstr+=`";
  });
  // 最后返回str
  myTemplate += "`\r\n return str \r\n}";
  // console.log(myTemplate)
  // 将拼接出的函数体 构建成函数
  let fn = new Function("obj", myTemplate);
  return fn(data);
};

// 最后就是拼接成这种形式 然后放在函数中执行 就能将传入的变量解析出来 模板引擎就实现了
// let str = ''
// with(obj){
//   str+=`
//   <!DOCTYPE html>
//   <html lang="en">
//     <head>
//       <meta charset="UTF-8" />
//       <meta http-equiv="X-UA-Compatible" content="IE=edge" />
//       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//       <title>Document</title>
//     </head>
//   <body>`
//   arr.forEach(item => {
//     str+=` ${ item} `
//   })
// str+=`
//   </body>
//   </html>
// `
//  return str
// }

async function render(tmplStr, data) {
  // 定义 let str = '';
  let myTemplate = `let str = ''\r\n`;
  // 将解析出的HTML放在with函数中
  myTemplate += "with(obj){";
  // str内容是模板字符串
  myTemplate += "str+=`";
  // 将<%= 变量 %>替换成 ${变量} 的形式
  tmplStr = tmplStr.replace(/<%=(.*?)%>/g, function () {
    return "${" + arguments[1] + "}";
  });
  // 将<% 语句 %> 替换成 语句 的形式 并拼接到myTemplate上
  myTemplate += tmplStr.replace(/<%(.*?)%>/g, function () {
    return "`\r\n" + arguments[1] + "\r\nstr+=`";
  });
  // 最后返回str
  myTemplate += "`\r\n return str \r\n}";
  // console.log(myTemplate)
  // 将拼接出的函数体 构建成函数
  let fn = new Function("obj", myTemplate);
  return fn(data);
}

exports.renderFile = renderFile;
exports.render = render;
