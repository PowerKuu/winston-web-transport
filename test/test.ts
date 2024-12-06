import winston from "winston"
import WebTransport from "../src/main"
import { join } from "path"

import dotenv from "dotenv"

dotenv.config()

export function createLogger() {
    const logger = winston.createLogger({
        format: winston.format.combine(
            winston.format.prettyPrint(),
            winston.format.errors(),
            winston.format.colorize(),
            winston.format.timestamp({
                format: "YYYY-MM-DD HH:mm:ss"
            }),
            winston.format.printf(
                (info) =>
                    `[${info.timestamp}] [${info.level}]: ${info.message}` +
                    (info.splat !== undefined ? `${info.splat}` : " ")
            )
        ),

        exitOnError: false,
        handleExceptions: true,
        handleRejections: true,

        transports: [
            new winston.transports.Console(),
            new WebTransport({
                port: 3005,
                password: "123",
                /*
                postgres: {
                    connectionUri: process.env.DATABASE_URL,
                    rejectUnauthorized: false,
                    logVersion: "1.0"
                }*/
                sqlite: {
                    filepath: join(__dirname, "logs.db"),
                    table: "logs2"
                }
            })
        ]
    })

    return logger
}

const logger = createLogger()
setInterval(() => {
    logger.info("Hello, worldsss!")
}, 2000)
