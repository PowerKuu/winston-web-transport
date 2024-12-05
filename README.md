# Winston web transport

This is a transport for winston which logs to a web server.

![Thubmnail](https://github.com/PowerKuu/winston-web-transport/blob/main/thumbnail.png?raw=true)

## Installation

```bash
npm install winston-web-transport
```

## Usage

```ts
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
            /*
            {
                port: number
                password?: string
                dateFormat?: string

                sqlite?: {
                    pragnationDate?: number
                    pragnationLimit?: number
                } & (
                    {
                        filepath: string
                        remote?: never
                    }
                    | {
                        filepath?: never
                        remote: {
                            url: string
                            username: string
                            password: string
                        }
                    }
                )
            }
            */
            new WebTransport({
                port: 3000,
                password: "123",
                sqlite: {
                    filepath: join(__dirname, "logs.db")
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
```
