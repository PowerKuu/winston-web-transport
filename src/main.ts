import Transport from "winston-transport"
import express from "express"

import http from "http"
import { join } from "path"

import { WebSocketServer } from "ws"
import { parse as parseCookie } from "cookie"

import crypto from "crypto"

export default class WebTransport extends Transport {
    server: http.Server
    logs: string[] = []

    ws: WebSocketServer
    authToken: string

    constructor(
        public options: Transport.TransportStreamOptions & {
            port: number
            password?: string
        }
    ) {
        super(options)

        const app = express()

        this.authToken = crypto.randomUUID()

        app.get("/", (req, res) => {
            res.sendFile(join(__dirname, "index.html"))
        })

        app.post("/login", (req, res) => {
            if (req.body.password === options.password) {
                res.cookie("authToken", this.authToken)
                res.sendStatus(200)
            }

            res.sendStatus(401)
        })

        this.server = app.listen(options.port)
        this.ws = new WebSocketServer({ server: this.server })

        this.ws.on("connection", (ws, req) => {
            if (options.password) {
                // Parse cookies from the 'req' headers
                const cookies = parseCookie(req.headers.cookie || "")

                // Example: Check for a specific cookie
                if (cookies.authToken !== this.authToken) {
                    ws.close(1008, "Unauthorized") // Close connection if unauthorized
                    return
                }
            }

            ws.send(
                JSON.stringify({
                    event: "logs",
                    data: this.logs
                })
            )
        })
    }

    public log(info: any, next: () => void) {
        const log = info[Symbol.for("message")]
        this.ws.clients.forEach((client) => {
            client.send(
                JSON.stringify({
                    event: "log",
                    data: log
                })
            )
        })

        this.logs.push(log)

        next()
    }

    public close(): void {
        this.server.close()
    }
}
