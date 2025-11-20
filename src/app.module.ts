import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvVars, validate } from './config';

// Core Modules
import { AppLoggerModule } from './modules/logger/app-logger.module';
import { TypedCqrsModule } from './modules/shared/cqrs/cqrs.module';

// Feature Modules
import { HealthModule } from './modules/health/health.module';
import { StreaksModule } from './modules/streaks/streaks.module';
import { LoggerModule, Params } from 'nestjs-pino';
import pino, { LevelWithSilent } from 'pino';
import {
  requestSerializer,
  responseSerializer,
} from './modules/logger/serializers';

const getLoggerConfig = (
  configService: ConfigService<EnvVars, true>,
): Params => {
  const isLocal = configService.get('IS_LOCAL', { infer: true });

  return {
    pinoHttp: {
      serializers: {
        err: pino.stdSerializers.err,
        req: requestSerializer,
        res: responseSerializer,
      },
      autoLogging: false,
      wrapSerializers: true,
      level: isLocal ? 'debug' : 'info',
      transport: isLocal
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true, // Enable for level coloring
              colorizeObjects: false, // Don't colorize objects, only levels
              singleLine: true, // Force single-line output
              translateTime: 'SYS:HH:MM:ss', // Use local system timezone
              // Message already formatted in BaseLogger with colors
              messageFormat: '{msg}',
            },
          }
        : undefined,
      customLogLevel: (_req, res, err): LevelWithSilent => {
        // Don't log HTTP requests when running locally
        if (isLocal) {
          return 'silent';
        }
        if (res.statusCode >= 400 && res.statusCode < 500) {
          return 'warn';
        } else if (res.statusCode >= 500 || err) {
          return 'error';
        } else if (res.statusCode >= 300 && res.statusCode < 400) {
          return 'silent';
        }
        return 'info';
      },
      customSuccessMessage: (req, res): string => {
        if (res.statusCode === 404) {
          return 'resource not found';
        }
        return `${req.method} completed`;
      },
      customReceivedMessage: (_req, _res): string => {
        return 'request received';
      },
      customErrorMessage: (_req, _res, _err): string => {
        return 'request errored with status code: ' + _res.statusCode;
      },
      customAttributeKeys: {
        req: 'request',
        res: 'response',
        err: 'error',
        responseTime: 'timeTaken',
      },
    },
  };
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getLoggerConfig,
    }),
    AppLoggerModule,
    TypedCqrsModule,
    HealthModule,
    StreaksModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
