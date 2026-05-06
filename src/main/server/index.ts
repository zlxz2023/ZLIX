import { FastifyInstance } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import fastify from 'fastify'

import { initQQMusicAPI } from './qqmusic'
import { initUnblockAPI } from './unblock'
import { initNcmAPI } from './netease'
import { serverLog } from '../logger'

export default async function initAppServer(): Promise<FastifyInstance> {
    const server = fastify({
        logger: {
            level: 'info',
            stream: {
                write: (message: string) => {
                    try {
                        const logObj = JSON.parse(message)
                        const { level, msg, req, res } = logObj
                        
                        let logMessage = `[Fastify] ${msg}`
                        
                        if (req) {
                            logMessage = `[API] ${req.method} ${req.url} - ${msg}`
                        }
                        
                        if (res) {
                            logMessage = `${logMessage} (${res.statusCode})`
                        }
                        
                        switch (level) {
                            case 10: // silly
                                serverLog.silly(logMessage)
                                break
                            case 20: // debug
                                serverLog.debug(logMessage)
                                break
                            case 30: // info
                                serverLog.info(logMessage)
                                break
                            case 40: // warn
                                serverLog.warn(logMessage)
                                break
                            case 50: // error
                                serverLog.error(logMessage)
                                break
                            case 60: // fatal
                                serverLog.error(`[FATAL] ${logMessage}`)
                                break
                            default:
                                serverLog.info(logMessage)
                        }
                    } catch {
                        serverLog.info(`[Fastify] ${message}`)
                    }
                }
            }
        }
    })

    server.register(fastifyCookie)
    server.register(fastifyMultipart)
    
    server.get('/api', (_, reply) => {
        reply.send({
            name: 'ZLIX API',
            description: 'Music API service',
        })
    })
    
    server.register(initQQMusicAPI, { prefix: '/api' })
    server.register(initUnblockAPI, { prefix: '/api' })
    server.register(initNcmAPI, { prefix: '/api' })
    
    const port = Number(process.env['VITE_SERVER_PORT'] || 23333)
    await server.listen({ port, host: '127.0.0.1' })

    serverLog.info(`Server running on port ${port}`)

    return server
}