const config = {
  port: {
    option: "-p, --port <n>",
    description: "set serve port",
    default: 8080,
    usage: "ms --port <n>",
  },
  directory: {
    option: "-d, --directory <d>",
    description: "set serve directory",
    default: process.cwd(),
    usage: "ms --directory <d>",
  },
};

module.exports = config;
