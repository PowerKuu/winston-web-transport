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
            this.database = new better_sqlite3_1.default(options.sqlite.filepath)
            // With date as number
            this.database.exec("CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, log TEXT, date INTEGER)")
        }
        this.server = app.listen(options.port)
        this.ws = new ws_1.WebSocketServer({ server: this.server })
        const date = (0, moment_1.default)().format(options.dateFormat || "YYYY-MM-DD HH:mm:ss")
        const sqliteFile = options.sqlite ? (0, path_1.parse)(options.sqlite.filepath) : undefined
        const usingSQLiteText = options.sqlite ? `SQLITE: "${sqliteFile?.name}${sqliteFile?.ext}"` : "IN MEMORY"
        this.sendLog(`\n📡  [\x1b[32mWEB SERVER STARTED ${date}, ${usingSQLiteText}\x1b[0m] 📡\n`)
        this.ws.on("connection", async (ws, req) => {
            if (options.password) {
                // Parse cookies from the 'req' headers
                const cookies = (0, cookie_1.parse)(req.headers.cookie || "")
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
    async sendLog(log) {
        if (this.database) {
            const insert = this.database.prepare("INSERT INTO logs (log, date) VALUES (?, ?)")
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
            const select = this.database.prepare("SELECT log FROM logs WHERE date > ? ORDER BY date DESC LIMIT ?")
            return select
                .all(this.options.sqlite?.pragnationDate || 0, this.options.sqlite?.pragnationLimit || 100000)
                .map((row) => row.log)
                .reverse()
        } else {
            return this.logs
        }
    }
    async log(info, next) {
        const log = info[Symbol.for("message")]
        await this.sendLog(log)
        next()
    }
    async close() {
        this.server.close()
        this.ws.close()
        this.database.close()
    }
}
exports.default = WebTransport
