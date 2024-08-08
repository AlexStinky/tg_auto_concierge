const winston = require('winston');
const util = require('util');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.simple(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'logs/info.log',
            maxsize: 1000000,
        }),
    ],
});

const createConsoleLogger = (level) => {
    return (...messages) => {
        const message = util.format(...messages);
        logger[level](message);
    }
}

const shutdown = (signal, reason, code) => {
    console.log('Server is shutting down', {code, reason, signal});
    setTimeout(() => process.exit(code), 10);
}

module.exports = {
    start() {
        console.log = createConsoleLogger('info');
        console.warn = createConsoleLogger('warn');
        console.error = createConsoleLogger('error');

        console.log('============== START ==============');

        process.on('message', (msg) => {if (msg === 'shutdown') shutdown('message', msg, 0)});
        process.on('SIGINT', (reason) => shutdown('SIGINT', reason, 0));
        process.on('SIGTERM', (reason) => shutdown('SIGTERM', reason, 0));
        process.on('SIGQUIT', (reason) => shutdown('SIGQUIT', reason, 0));
        process.on('uncaughtException', (reason) => shutdown('uncaughtException', reason, 1));
        process.on('unhandledRejection', (reason) => shutdown('unhandledRejection', reason, 1));
    }
}


