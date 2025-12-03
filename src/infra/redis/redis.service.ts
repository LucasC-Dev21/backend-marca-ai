import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  private handleError(error: any, method: string, key?: string) {
    this.logger.error(
      `[${method}] Erro Redis${key ? ` (chave: ${key})` : ''}`,
      error.stack,
    );
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const data = typeof value === 'string' ? value : JSON.stringify(value);
      ttl
        ? await this.redis.set(key, data, 'EX', ttl)
        : await this.redis.set(key, data);
    } catch (error) {
      this.handleError(error, 'set', key);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      this.handleError(error, 'get', key);
      return null;
    }
  }

  async update(key: string, newValue: any): Promise<boolean> {
    try {
      const ttl = await this.redis.ttl(key);
      if (ttl === -2) return false;
      const data =
        typeof newValue === 'string' ? newValue : JSON.stringify(newValue);

      if (ttl > 0) {
        await this.redis.set(key, data, 'EX', ttl);
      } else {
        await this.redis.set(key, data);
      }

      return true;
    } catch (error) {
      this.handleError(error, 'update', key);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.handleError(error, 'delete', key);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(key)) === 1;
    } catch (error) {
      this.handleError(error, 'exists', key);
      return false;
    }
  }

  async getTTL(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.handleError(error, 'getTTL', key);
      return -2;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      return (await this.redis.expire(key, ttl)) === 1;
    } catch (error) {
      this.handleError(error, 'expire', key);
      return false;
    }
  }

  async increment(key: string, by = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, by);
    } catch (error) {
      this.handleError(error, 'increment', key);
      return 0;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      this.handleError(error, 'keys', pattern);
      return [];
    }
  }

  async decrement(key: string, by = 1): Promise<number> {
    try {
      return await this.redis.decrby(key, by);
    } catch (error) {
      this.handleError(error, 'decrement', key);
      return 0;
    }
  }
}
