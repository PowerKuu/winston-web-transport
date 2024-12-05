import Transport from "winston-transport"
import express from "express"

import http from "http"
import { join, parse } from "path"

import { WebSocketServer } from "ws"
import { parse as parseCookie } from "cookie"

import crypto from "crypto"
import SQLiteDatabase from "better-sqlite3"

import moment from "moment"
import { mkdirSync } from "fs"

import { Client as postgresDatabase } from "pg"


export default class WebTransport extends Transport {
    server: http.Server
    logs: string[] = []

    ws: WebSocketServer
    authToken: string

    sqLiteDatabase?: SQLiteDatabase.Database
    postgresDatabase?: postgresDatabase

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

            postgres?: {
                connectionUri: string

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
            mkdirSync(parse(options.sqlite.filepath).dir, { recursive: true })
            this.sqLiteDatabase = new SQLiteDatabase(options.sqlite.filepath)

            // With date as number
            this.sqLiteDatabase.exec("CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, log TEXT, date INTEGER)")
        }

        if (options.postgres) {
            this.postgresDatabase = new postgresDatabase({
                connectionString: options.postgres.connectionUri,
                ssl: {
                    rejectUnauthorized: false
                }
            })

            this.postgresDatabase.connect()

            this.postgresDatabase.query(`
                CREATE TABLE IF NOT EXISTS logs (
                    id SERIAL PRIMARY KEY,
                    log TEXT,
                    date TIMESTAMP
                )
            `)
        }

        this.server = app.listen(options.port)
        this.ws = new WebSocketServer({ server: this.server })

        const date = moment().format(options.dateFormat || "YYYY-MM-DD HH:mm:ss")
        const sqliteFile = options.sqlite ? parse(options.sqlite.filepath) : undefined

        const usingDatabaseText = options.sqlite ? `SQLITE: "${sqliteFile?.name}${sqliteFile?.ext}"` : options.postgres ? "POSTGRES" : "NO DATABASE"
        this.sendLog(`\n📡  [\x1b[32mWEB SERVER STARTED ${date}, ${usingDatabaseText}\x1b[0m] 📡\n`)

        this.ws.on("connection", async (ws, req) => {
            if (options.password) {
                const cookies = parseCookie(req.headers.cookie || "")

                if (cookies.authToken !== this.authToken) {
                    ws.close(1008, "Unauthorized")
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
        if (this.sqLiteDatabase) {
            const insert = this.sqLiteDatabase.prepare<[string, number]>("INSERT INTO logs (log, date) VALUES (?, ?)")

            insert.run(log, Date.now())
        }

        if (this.postgresDatabase) {
            this.postgresDatabase.query("INSERT INTO logs (log, date) VALUES ($1, $2)", [log, new Date()])
        }

        this.logs.push(log)

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
        if (this.sqLiteDatabase) {
            const select = this.sqLiteDatabase.prepare<[number, number], { log: string }>(
                "SELECT log FROM logs WHERE date > ? ORDER BY date DESC LIMIT ?"
            )

            return select
                .all(this.options.sqlite?.pragnationDate || 0, this.options.sqlite?.pragnationLimit || 100000)
                .map((row) => row.log)
                .reverse()
        }

        if (this.postgresDatabase) {
            const select = await this.postgresDatabase.query("SELECT log FROM logs WHERE date > $1 ORDER BY date DESC LIMIT $2", [
                new Date(this.options.postgres?.pragnationDate || 0),
                this.options.postgres?.pragnationLimit || 100000
            ])

            console.log(select.rows)

            return select.rows.map((row: { log: string }) => row.log).reverse()
        }

        return this.logs
    }

    public async log(info: any, next: () => void) {
        const log = info[Symbol.for("message")]

        await this.sendLog(log)

        next()
    }

    public async close() {
        this.server.close()
        this.ws.close()

        if (this.sqLiteDatabase) this.sqLiteDatabase.close()
        if (this.postgresDatabase) this.postgresDatabase.end()
    }
}
