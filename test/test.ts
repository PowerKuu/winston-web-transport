import winston from "winston"
import WebTransport from "../src/main"
import { join } from "path"

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
                port: 3000,
                password: "123",
                postgres: {
                    connectionUri: "postgres://uagk6ve2oo0pnk:pc7e9378814c0dbdad1710d301170269dfe1d921ae886633e35c57c79a819c30f@c9tiftt16dc3eo.cluster-czz5s0kz4scl.eu-west-1.rds.amazonaws.com:5432/d3nhjpd2aevjcl?sslmode=require",
                    pragnationLimit: 10
                }
            })
        ]
    })

    return logger
}

const logger = createLogger()
setInterval(() => {
    logger.info("Hello, world!")
}, 5000)
