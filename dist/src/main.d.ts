import Transport from "winston-transport"
import http from "http"
import { WebSocketServer } from "ws"
import SQLiteDatabase from "better-sqlite3"
import { Client as postgresDatabase } from "pg"
export default class WebTransport extends Transport {
    options: Transport.TransportStreamOptions & {
        port: number
        password?: string
        dateFormat?: string
        sqlite?: {
            filepath: string
            table: string
            paginationnDate?: Date
            paginationnLimit?: number
            logVersion?: string
        }
        postgres?: {
            connectionUri: string
            table: string
            paginationnDate?: Date
            paginationnLimit?: number
            rejectUnauthorized?: boolean
            logVersion?: string
        }
    }
    server: http.Server
    logs: string[]
    ws: WebSocketServer
    authToken: string
    sqLiteDatabase?: SQLiteDatabase.Database
    postgresDatabase?: postgresDatabase
    constructor(
        options: Transport.TransportStreamOptions & {
            port: number
            password?: string
            dateFormat?: string
            sqlite?: {
                filepath: string
                table: string
                paginationnDate?: Date
                paginationnLimit?: number
                logVersion?: string
            }
            postgres?: {
                connectionUri: string
                table: string
                paginationnDate?: Date
                paginationnLimit?: number
                rejectUnauthorized?: boolean
                logVersion?: string
            }
        }
    )
    sendLog(log: string): Promise<void>
    loadLogs(): Promise<string[]>
    log(info: any, next: () => void): Promise<void>
    close(): Promise<void>
}
