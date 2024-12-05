import Transport from "winston-transport"
import express from "express"

import http from "http"
import { join, parse } from "path"

import { WebSocketServer } from "ws"
import { parse as parseCookie } from "cookie"

import crypto from "crypto"
import Database from "better-sqlite3"

import moment from "moment"

export default class WebTransport extends Transport {
    server: http.Server
    logs: string[] = []

    ws: WebSocketServer
    authToken: string

    database: Database.Database

    constructor(
        public options: Transport.TransportStreamOptions & {
            port: number
            password?: string
            dateFormat?: string

            sqlite?: {
                filepath: string
                pragnationDate?: number
                pragnationLimit?: number
            }
        }
    ) {
        super(options)

        const app = express()
        app.use(express.json())

        this.authToken = crypto.randomUUID()

        app.get("/", (req, res) => {
            res.sendFile(join(__dirname, "index.html"))
        })

        app.post("/login", (req, res) => {
            if (req.body.password === options.password) {
                res.cookie("authToken", this.authToken)
                res.sendStatus(200)
                return
            }

            res.sendStatus(401)
        })

        if (options.sqlite) {
            this.database = new Database(options.sqlite.filepath)

            // With date as number
            this.database.exec("CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, log TEXT, date INTEGER)")
        }

        this.server = app.listen(options.port)
        this.ws = new WebSocketServer({ server: this.server })

        const date = moment().format(options.dateFormat || "YYYY-MM-DD HH:mm:ss")
        const sqliteFile = options.sqlite ? parse(options.sqlite.filepath) : undefined

        const usingSQLiteText = options.sqlite ? `SQLITE: "${sqliteFile?.name}${sqliteFile?.ext}"` : "IN MEMORY"
        this.sendLog(`\n📡  [\x1b[32mWEB SERVER STARTED ${date}, ${usingSQLiteText}\x1b[0m] 📡\n`)

        this.ws.on("connection", async (ws, req) => {
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
                    data: await this.loadLogs()
                })
            )
        })
    }

    async sendLog(log: string) {
        if (this.database) {
            const insert = this.database.prepare<[string, number]>("INSERT INTO logs (log, date) VALUES (?, ?)")

            insert.run(log, Date.now())
        } else {
            this.logs.push(log)
        }

        this.ws.clients.forEach((client) => {
            client.send(
                JSON.stringify({
                    event: "log",
                    data: log
                })
            )
        })
    }

    async loadLogs() {
        if (this.database) {
            const select = this.database.prepare<[number, number], { log: string }>(
                "SELECT log FROM logs WHERE date > ? ORDER BY date DESC LIMIT ?"
            )

            return select
                .all(this.options.sqlite?.pragnationDate || 0, this.options.sqlite?.pragnationLimit || 100000)
                .map((row) => row.log)
                .reverse()
        } else {
            return this.logs
        }
    }

    public async log(info: any, next: () => void) {
        const log = info[Symbol.for("message")]

        await this.sendLog(log)

        next()
    }

    public async close() {
        this.server.close()
        this.ws.close()
        this.database.close()
    }
}
