"use strict"
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, "__esModule", { value: true })
const winston_transport_1 = __importDefault(require("winston-transport"))
const express_1 = __importDefault(require("express"))
const path_1 = require("path")
const ws_1 = require("ws")
const cookie_1 = require("cookie")
const crypto_1 = __importDefault(require("crypto"))
const better_sqlite3_1 = __importDefault(require("better-sqlite3"))
const moment_1 = __importDefault(require("moment"))
const fs_1 = require("fs")
const pg_1 = require("pg")
class WebTransport extends winston_transport_1.default {
    constructor(options) {
        super(options)
        this.options = options
        this.logs = []
        const app = (0, express_1.default)()
        app.use(express_1.default.json())
        this.authToken = crypto_1.default.randomUUID()
        app.get("/", (req, res) => {
            res.sendFile((0, path_1.join)(__dirname, "index.html"))
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
            ;(0, fs_1.mkdirSync)((0, path_1.parse)(options.sqlite.filepath).dir, { recursive: true })
            this.sqLiteDatabase = new better_sqlite3_1.default(options.sqlite.filepath)
            this.sqLiteDatabase.exec(
                `CREATE TABLE IF NOT EXISTS ${options.sqlite.table} (id INTEGER PRIMARY KEY, log TEXT, date TIMESTAMP)`
            )
        }
        if (options.postgres) {
            if (options.postgres.rejectUnauthorized == false) {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
            }
            this.postgresDatabase = new pg_1.Client({
                connectionString: options.postgres.connectionUri,
                ssl: {
                    rejectUnauthorized: options.postgres.rejectUnauthorized == false ? false : true
                }
            })
            this.postgresDatabase.connect()
            this.postgresDatabase.query(`
                CREATE TABLE IF NOT EXISTS ${options.postgres.table} (
                    id SERIAL PRIMARY KEY,
                    log TEXT,
                    date TIMESTAMP
                )
            `)
        }
        this.server = app.listen(options.port)
        this.ws = new ws_1.WebSocketServer({ server: this.server })
        const date = (0, moment_1.default)().format(options.dateFormat || "YYYY-MM-DD HH:mm:ss")
        const sqliteFile = options.sqlite ? (0, path_1.parse)(options.sqlite.filepath) : undefined
        const logVersion = options.sqlite?.logVersion || options.postgres?.logVersion || ""
        const logVersionText = logVersion ? `, LOG VERSION: ${logVersion}` : ""
        const table = options.sqlite?.table || options.postgres?.table
        const tableText = table ? `, TABLE: ${table}` : ""
        const usingDatabaseText = options.sqlite
            ? `SQLITE(${sqliteFile?.name}${sqliteFile?.ext})`
            : options.postgres
              ? "POSTGRES"
              : "MEMORY"
        this.sendLog(
            `\n📡  [\x1b[32mWEB SERVER STARTED ${date}, DATABASE: ${usingDatabaseText}${tableText}${logVersionText}\x1b[0m] 📡\n`
        )
        this.ws.on("connection", async (ws, req) => {
            if (options.password) {
                const cookies = (0, cookie_1.parse)(req.headers.cookie || "")
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
    async sendLog(log) {
        if (this.sqLiteDatabase && this.options.sqlite) {
            const insert = this.sqLiteDatabase.prepare(
                `INSERT INTO ${this.options.sqlite.table} (log, date) VALUES (?, ?)`
            )
            insert.run(log, Date.now())
        }
        if (this.postgresDatabase && this.options.postgres) {
            this.postgresDatabase.query(`INSERT INTO ${this.options.postgres.table} (log, date) VALUES ($1, $2)`, [
                log,
                new Date()
            ])
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
        if (this.sqLiteDatabase && this.options.sqlite) {
            const select = this.sqLiteDatabase.prepare(
                `SELECT log FROM ${this.options.sqlite.table} WHERE date > ? ORDER BY date DESC LIMIT ?`
            )
            return select
                .all(
                    this.options.sqlite?.paginationnDate?.getTime() || 0,
                    this.options.sqlite?.paginationnLimit || 100000
                )
                .map((row) => row.log)
                .reverse()
        }
        if (this.postgresDatabase && this.options.postgres) {
            const select = await this.postgresDatabase.query(
                `SELECT log FROM ${this.options.postgres.table} WHERE date > $1 ORDER BY date DESC LIMIT $2`,
                [
                    new Date(this.options.postgres?.paginationnDate?.getTime() || 0),
                    this.options.postgres?.paginationnLimit || 100000
                ]
            )
            return select.rows.map((row) => row.log).reverse()
        }
        return this.logs
    }
    async log(info, next) {
        const log = info[Symbol.for("message")]
        await this.sendLog(log)
        next()
    }
    async close() {
        this.server.close()
        this.ws.close()
        if (this.sqLiteDatabase) this.sqLiteDatabase.close()
        if (this.postgresDatabase) this.postgresDatabase.end()
    }
}
exports.default = WebTransport
