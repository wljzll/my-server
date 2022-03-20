const http = require("http");
const fs = require("fs").promises;
const path = require("path");
const url = require("url");
const mime = require("mime");
const os = require("os");
const chalk = require("chalk");
const { createReadStream, readFileSync } = require("fs");
const { render } = require("./util");
const zlib = require("zlib");

// 获取本地电脑的IPv4地址
let interfaces = os.networkInterfaces();
let address = Object.values(interfaces)
  .flat()
  .find((item) => item.family === "IPv4").address;

// 读取模板
const template = readFileSync(path.resolve(__dirname, "tmpl.html"), "utf-8");

module.exports = class Server {
  constructor(opts = {}) {
    this.port = opts.port;
    this.directory = opts.directory;
    this.address = address;
    this.template = template;
  }
  // ES7 实现更改this 低版本node可能不支持 不支持可以采用ES6箭头函数或者bind
  // 服务监听函数
  handleRequest = async (req, res) => {
    // 请求到来的时候 需要监控请求路径 1) 如果是文件直接将文件返回 2)如果不是文件则读取文件中的目录
    // 获取请求路径
    let { pathname } = url.parse(req.url);
    // 中文路径会自动编码成16进制Buffer 这里给转回中文
    pathname = decodeURIComponent(pathname);
    // 在执行ms脚本的目录下查找
    let filePath = path.join(this.directory, pathname);
    try {
      let statObj = await fs.stat(filePath);
      if (statObj.isDirectory(filePath)) {
        const dirs = await fs.readdir(filePath);
        // 访问路径时 返回一个文件夹列表
        let content = await render(template, {
          dirs: dirs.map((dir) => ({
            url: path.join(pathname, dir),
            dir,
          })),
        });
        res.setHeader("Content-Type", "text/html;charset=utf-8");
        res.end(content);
      } else {
        // 是文件
        this.sendFile(req, res, statObj, filePath);
      }
    } catch (error) {
      // 访问的路径或者文件不存在进行错误处理
      this.sendError(res, error);
    }
  };
  gzip(req, res) {
    // 在发送之前 进行压缩处理 浏览器和服务器说 Accept-Encoding: gzip, deflate, br(浏览器支持的压缩方式)
    // 服务器返回: content-encoding: gzip(服务器是通过gzip压缩的)

    // 获取请求头中支持的压缩方式
    let encoding = req.headers["accept-encoding"];

    let zip;
    // 判断浏览器是否支持压缩
    if (encoding) {
      // 分割支持的压缩方式
      let ways = encoding.split(", ");
      for (let i = 0; i < ways.length; i++) {
        let lib = ways[i];
        if (lib === "gzip") {
          res.setHeader("content-encoding", "gzip");
          zip = zlib.createGzip();
          break;
        } else if (lib === "deflate") {
          res.setHeader("content-encoding", "deflate");
          zip = zlib.createDeflate();
          break;
        }
      }
    }
    return zip;
  }
  sendFile(req, res, statObj, filePath) {
    const zip = this.gzip(req, res);
    // 如果HTML文件不指定编码　这里也不设置　会乱码
    // 如果文件没有后缀名的话 默认是文本
    res.setHeader(
      "content-type",
      mime.getType(filePath) || "text/plain" + ";charset=utf-8"
    );
    if (zip) {
      // 可写流 读取完毕 自动res.end()
      createReadStream(filePath).pipe(zip).pipe(res);
    } else {
      // 可写流 读取完毕 自动res.end()
      createReadStream(filePath).pipe(res);
    }
  }
  // 路径错误处理
  sendError(res, error) {
    // 将状态码设置成404
    res.statusCode = 404;
    // 设置响应内容
    res.end("NOT FOUND");
  }
  start() {
    // 创建服务
    const server = http.createServer(this.handleRequest);
    // 监听输入命令行输入的端口 启动服务
    server.listen(this.port, () => {
      console.log(
        `${chalk.green("Starting up http-server, serving")} ${this.directory}`
      );
      console.log(`http://${address}:${chalk.green(this.port)}`);
      console.log(`http://127.0.0.1:${this.port}`);
    });
  }
};
