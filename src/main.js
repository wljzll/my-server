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
const crypto = require('crypto');

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
  }
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
  cache(req, res, statObj, filePath) {
    // 强制缓存 - 
    // 1. 强制缓存对于直接请求的资源不生效，比如我们直接请求index.html index.html是不会被缓存的
    // 2. 浏览器不能开Disable Cache选项 不然也会不生效
    // res.setHeader('Cache-Control', 'max-age=10'); //单位：S 10S内我引用的其他资源不要再访问了
    // res.setHeader('Expires', new Date(Date.now() + 10 * 1000).toGMTString())


    // 协商缓存
    
    // 1. 根据文件修改时间来协商
    res.setHeader('Cache-Control', 'no-cache'); // no-cache表示浏览器缓存中有 但是每次也要来服务器询问  no-store: 表示不缓存
    const IfModifiedSince = req.headers['if-modified-since'];
    const ctime = statObj.ctime.toGMTString(); // 文件的最后修改时间
    res.setHeader('last-modified', ctime);

    // 根据文件的最后修改时间来判断 会有种情况就是文件修改时间变了，但是内容没变化 或者1S内多次改变也监控不到
    if(IfModifiedSince !== ctime) { // 上次返回给客户端的文件修改时间和本次请求时的文件修改时间是否相同
        return false;
    }
    
    // 2. 根据内容来生成一个唯一的标识 ETAG来协商
    const ifNoneMatch = req.headers['if-none-match'];
    let etag = crypto.createHash('md5').update(readFileSync(filePath)).digest('base64'); // 实际上 不会去读取文件内容来生成摘要
    res.setHeader('ETag', etag);
    if(ifNoneMatch !== etag) { // 上次返回给客户端的文件内容摘要和本次请求时的文件内容摘要是否相同
        return false;
    }
    return true;
  }
  sendFile(req, res, statObj, filePath) {
    if (this.cache(req, res, statObj, filePath)) {
        res.statusCode = 304;
        return res.end();
    }
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
      console.log(error);
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
