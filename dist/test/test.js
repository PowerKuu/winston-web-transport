"use strict"
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, "__esModule", { value: true })
exports.createLogger = void 0
const winston_1 = __importDefault(require("winston"))
const main_1 = __importDefault(require("../src/main"))
const path_1 = require("path")
function createLogger() {
    const logger = winston_1.default.createLogger({
        format: winston_1.default.format.combine(
            winston_1.default.format.prettyPrint(),
            winston_1.default.format.errors(),
            winston_1.default.format.colorize(),
            winston_1.default.format.timestamp({
                format: "YYYY-MM-DD HH:mm:ss"
            }),
            winston_1.default.format.printf(
                (info) =>
                    `[${info.timestamp}] [${info.level}]: ${info.message}` +
                    (info.splat !== undefined ? `${info.splat}` : " ")
            )
        ),
        exitOnError: false,
        handleExceptions: true,
        handleRejections: true,
        transports: [
            new winston_1.default.transports.Console(),
            new main_1.default({
                port: 3000,
                password: "123",
                sqlite: {
                    filepath: (0, path_1.join)(__dirname, "logs.db")
                }
            })
        ]
    })
    return logger
}
exports.createLogger = createLogger
const logger = createLogger()
setInterval(() => {
    logger.info("Hello, world!")
}, 5000)
