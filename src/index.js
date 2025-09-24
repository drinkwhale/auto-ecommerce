require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const cron = require('node-cron');
const path = require('path');

// 라우트 및 미들웨어 import
const marketRoutes = require('./routes/marketRoutes');
const { testConnection } = require('./config/database');
const { Success, Error } = require('./utils/response');

// 로거 설정
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH || './logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH || './logs/app.log'
    })
  ]
});

// Express 앱 생성
const app = express();
const PORT = process.env.PORT || 3000;

// 기본 미들웨어 설정
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-ID', 'X-API-Key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 제공
app.use('/static', express.static(path.join(__dirname, '../public')));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  const startTime = Date.now();

  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      clientId: req.headers['x-client-id'] || 'anonymous'
    });
  });

  next();
});

// Health Check 엔드포인트
app.get('/', (req, res) => {
  res.json(Success({
    service: 'Auto E-commerce Open Market Integration API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  }, 'Service is running successfully'));
});

app.get('/health', (req, res) => {
  res.json(Success({
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  }, 'Health check passed'));
});

// API 라우트 설정
app.use('/api/markets', marketRoutes);

// API 문서 (개발 환경에서만)
if (process.env.NODE_ENV !== 'production') {
  const swaggerJsdoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');

  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Auto E-commerce Open Market Integration API',
        version: '1.0.0',
        description: '국내 오픈마켓 통합 상품 등록 및 관리 API',
        contact: {
          name: 'Auto E-commerce Team',
          email: 'support@auto-ecommerce.com'
        }
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Development server'
        }
      ],
      tags: [
        { name: 'Products', description: '상품 관리 API' },
        { name: 'Orders', description: '주문 관리 API' },
        { name: 'Inventory', description: '재고 관리 API' },
        { name: 'Categories', description: '카테고리 관리 API' },
        { name: 'Jobs', description: '작업 관리 API' },
        { name: 'System', description: '시스템 관리 API' }
      ]
    },
    apis: ['./src/routes/*.js']
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Auto E-commerce API Documentation'
  }));

  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
}

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json(Error('API endpoint not found', null, 404));
});

// 전역 에러 핸들러
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Multer 에러 처리
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(Error('File too large', 'Maximum file size exceeded', 400));
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json(Error('Too many files', 'Maximum file count exceeded', 400));
  }

  // JSON 파싱 에러
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json(Error('Invalid JSON', 'Request body contains invalid JSON', 400));
  }

  // 기타 에러
  const statusCode = error.statusCode || error.status || 500;
  res.status(statusCode).json(
    Error('Internal server error', process.env.NODE_ENV === 'production' ? null : error.message, statusCode)
  );
});

/**
 * 서버 시작 함수
 */
async function startServer() {
  try {
    // 데이터베이스 연결 테스트
    logger.info('Testing database connection...');
    await testConnection();

    // 필요한 디렉토리 생성
    await ensureDirectories();

    // 크론 작업 스케줄링
    setupCronJobs();

    // 서버 시작
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 API Base URL: http://localhost:${PORT}/api/markets`);

      if (process.env.NODE_ENV !== 'production') {
        logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      }
    });

    // Graceful shutdown 처리
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // 정리 작업 수행
          await cleanupResources();
          logger.info('Cleanup completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during cleanup:', error);
          process.exit(1);
        }
      });

      // 강제 종료 (10초 후)
      setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * 필요한 디렉토리를 생성합니다
 */
async function ensureDirectories() {
  const fs = require('fs').promises;
  const directories = [
    'logs',
    'temp',
    'temp/images',
    'data'
  ];

  for (const dir of directories) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }
}

/**
 * 크론 작업을 설정합니다
 */
function setupCronJobs() {
  // 매시간 임시 파일 정리
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Running hourly cleanup job...');

      // 여기에 실제 정리 로직 추가
      // 예: 임시 이미지 파일 정리, 완료된 작업 정리 등

      logger.info('Hourly cleanup completed');
    } catch (error) {
      logger.error('Hourly cleanup failed:', error);
    }
  });

  // 매일 자정 로그 파일 정리
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Running daily log cleanup job...');

      // 오래된 로그 파일 정리 로직

      logger.info('Daily log cleanup completed');
    } catch (error) {
      logger.error('Daily log cleanup failed:', error);
    }
  });

  // 30분마다 주문 동기화 (설정에 따라)
  if (process.env.AUTO_ORDER_SYNC === 'true') {
    cron.schedule('*/30 * * * *', async () => {
      try {
        logger.info('Running automatic order synchronization...');

        // 자동 주문 동기화 로직

        logger.info('Automatic order synchronization completed');
      } catch (error) {
        logger.error('Automatic order synchronization failed:', error);
      }
    });
  }

  logger.info('Cron jobs scheduled successfully');
}

/**
 * 리소스를 정리합니다
 */
async function cleanupResources() {
  // Redis 연결 정리, 임시 파일 정리 등
  logger.info('Cleaning up resources...');
}

// 처리되지 않은 Promise 거부 및 예외 처리
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// 서버 시작
if (require.main === module) {
  startServer();
}

module.exports = app;