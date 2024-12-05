/// <reference types="node" />
import Transport from "winston-transport"
import http from "http"
import { WebSocketServer } from "ws"
import Database from "better-sqlite3"
export default class WebTransport extends Transport {
    options: Transport.TransportStreamOptions & {
        port: number
        password?: string
        dateFormat?: string
        sqlite?: {
            filepath: string
            pragnationDate?: number
            pragnationLimit?: number
        }
    }
    server: http.Server
    logs: string[]
    ws: WebSocketServer
    authToken: string
    database: Database.Database
    constructor(
        options: Transport.TransportStreamOptions & {
            port: number
            password?: string
            dateFormat?: string
            sqlite?: {
                filepath: string
                pragnationDate?: number
                pragnationLimit?: number
            }
        }
    )
    sendLog(log: string): Promise<void>
    loadLogs(): Promise<string[]>
    log(info: any, next: () => void): Promise<void>
    close(): Promise<void>
}
