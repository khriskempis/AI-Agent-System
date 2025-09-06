/**
 * Logger utility using Winston
 * Provides structured logging for the Director MCP Server
 */

import winston from 'winston';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4
};

// Create logger instance
export const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  defaultMeta: {
    service: 'director-mcp-server',
    pid: process.pid
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    })
  ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: path.join(__dirname, '../../logs/exceptions.log') 
  })
);

logger.rejections.handle(
  new winston.transports.File({ 
    filename: path.join(__dirname, '../../logs/rejections.log') 
  })
);

// Add request logging helper
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration_ms: duration,
      user_agent: req.get('User-Agent'),
      ip: req.ip,
      task_id: req.headers['x-director-task-id'],
      workflow_id: req.headers['x-director-workflow-id']
    });
  });
  
  next();
};

export default logger;
