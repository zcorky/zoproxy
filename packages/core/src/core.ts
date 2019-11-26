import * as stream from 'stream';
import { Response } from 'node-fetch';
import { Onion, Input, Middleware, Context } from '@zodash/onion';
import { getLogger } from '@zodash/logger';
import LRU from '@zcorky/lru';
import { md5 } from '@zodash/crypto/lib/md5';
import { omit } from '@zodash/omit';

import { request } from './utils/request';

import {
  Config,
  RequestInput, RequestOutput,
} from './interface';

import { getTarget } from './utils/get-target';
import { getUrl } from './utils/get-url';
import { getBody } from './utils/get-body';

const debug = require('debug')('datahub');

declare module '@zodash/onion' {
  export interface Input  {
    request: RequestInput;
  }

  export interface Output extends RequestOutput {

  }

  export interface Context {
    state: {
      readonly requestStartTime: number;
      readonly requestCount: { all: number, fail: number, count(type: 'all' | 'fail'): void };
      readonly requestCache: LRU<string, RequestOutput>;
      readonly target: string;

      requestTime: number;

      md5Key: string;
    };
  }
}

export class Proxy extends Onion {
  private logger = getLogger('datahub');;

  constructor(public readonly config: Config) {
    super();

    this.setup();
  }

  public handle(): Middleware<Context> {
    return async (ctx) => {
      const { method, path, headers, body: _body } = ctx.input.request;

      const url = getUrl(path, ctx.state.target);
      const body = getBody(_body, method);

      debug('=>', method, url, headers, body);
      
      const response = await request(url, {
        method,
        headers,
        body,
      });

      debug('<=', method, url, response.status, response.headers);

      response.headers.set('X-RunTime', ctx.state.requestTime + '');
      
      ctx.output.response = response;
    };
  }

  public async request(input: RequestInput): Promise<RequestOutput> {
    return await this
      .execute({ request: input })
      // .then(({ response }) => response);
  }

  //
  private setup() {
    // 1.request time => requestStartTime (before) and requestTime(after)
    this.use(this.useRequestTime());
    // 1.1 caculate target
    this.use(this.useFinalTarget());
    // 2.access log => 
    this.use(this.useRecordAccess());
    // 3.count request => requestCount
    this.use(this.useCountRequest());
    // 4.cache request => requestCache
    this.use(this.useCache());
    // 5.catch fatal error
    this.use(this.useCatchError());
    // 6.catch status error
    this.use(this.useStatusError());
    // 7.change request header
    this.use(this.useChangeRequestHeaders());
    // 8.change response header
    this.use(this.useChangeResponseHeaders());
  }

  private useRequestTime(): Middleware<Context> {
    return async (ctx, next) => {
      // init
      if (!ctx.state) {
        ctx.state = {} as any;
      }

      // init
      (ctx.state as any).requestStartTime = +new Date();

      await next!();

      const requestTime = +new Date() - ctx.state.requestStartTime;
      
      // init
      (ctx.state as any).requestTime = requestTime;
    };
  }

  private useFinalTarget(): Middleware<Context> {
    return async (ctx, next) => {
      const { target: _target, enableDynamicTarget } = this.config!;
      const { target: _dynamicTarget } = ctx.input.request;

      (ctx.state as any).target = getTarget(_target, _dynamicTarget, enableDynamicTarget);

      await next!();
    };
  }

  private useRecordAccess(): Middleware<Context> {
    return async (ctx, next) => {
      const { target } = ctx.state;
      const { method, path } = ctx.input.request;

      this.logger.log(`=> ${method} ${path} (target: ${target})`);

      await next!();

      const { status } = ctx.output.response;
      const requestTime = +new Date() - ctx.state.requestStartTime;
      
      this.logger.log(`<= ${method} ${path} ${status} +${requestTime} (target: ${target})`);
    };
  }

  private useCountRequest(): Middleware<Context> {
    const requestCount = {
      all: 0,
      fail: 0,
      count(type: 'all' | 'fail') {
        this[type] += 1;
      },
    };

    const cache = new LRU();
    const tickKey = Symbol('tick');

    return async (ctx, next) => {
      (ctx.state as any).requestCount = requestCount;

      requestCount.count('all');
      
      if (!cache.get(tickKey)) {
        this.logger.log(
          'Gateway:', this.config.target || 'None',
          'Count:', `${requestCount.all}/${requestCount.fail}`);
    
        cache.set(tickKey, true, { maxAge: 10000 });
      }

      await next!();
    };
  }
  
  private useCache(): Middleware<Context> {
    const memoryCache = new LRU<string, RequestOutput>();

    return async (ctx, next) => {
      // init
      (ctx.state as any).requestCache = memoryCache;

      const { cache } = this.config;
      const { method, path } = ctx.input.request;
      const { requestStartTime } = ctx.state;

      const md5Key = md5(JSON.stringify(ctx.input));

      // 命中缓存
      if (cache && (method === 'GET' || method === 'HEAD')) {
        const cachedRequestOutput = memoryCache.get(md5Key);
  
        if (cachedRequestOutput) {
          const requestTime = +new Date() - requestStartTime;
          ctx.state.requestTime = requestTime;
  
          if (cachedRequestOutput instanceof Error) {
            this.logger.log(`${method} ${path} ${(cachedRequestOutput as any).status} +${requestTime} (hit cache)`);
  
            throw cachedRequestOutput;
          }
  
          this.logger.log(`${method} ${path} ${cachedRequestOutput.response.status} +${requestTime} (hit cache)`);
          
          ctx.output.response = cachedRequestOutput.response.clone();
          return ;
        }
      }

      ctx.state.md5Key = md5Key;
      await next!();

      // 成功缓存
      if (cache) {
        const output = {
          ...ctx.output,
          response: ctx.output.response.clone(),
        };
        
        memoryCache.set(md5Key, output, { maxAge: (cache.ok || 0) * 1000 }); // @TODO
      }
    };
  }

  private useCatchError(): Middleware<Context> {
    return async (ctx, next) => {
      try {
        await next!();
      } catch (error) {
        const { requestStartTime, requestCache } = ctx.state;

        const requestTime = +new Date() - requestStartTime;
        ctx.state.requestTime = requestTime;

        error.status = error.status || 500;
        error.message = error.message || `Gateway Error: ${error.message} +${requestTime}`;
        
        const { method, path } = ctx.input.request;
        this.logger.log(`${method} ${path} ${error.status} (Gateway Status Error)`);
        this.logger.error(error);

        // count fail
        ctx.state.requestCount.count('fail');

        // 避免缓存击穿
        const { cache } = this.config;
        if (cache) {
          requestCache.set(ctx.state.md5Key, error, { maxAge: (cache.fatal) * 1000 });
        }

        throw error;
      }
    }
  }

  private useStatusError(): Middleware<Context> {
    return async (ctx, next) => {
      await next!();

      const { method, path } = ctx.input.request;
      const response = ctx.output.response;
      const { status: _status, statusText } = response;

      if (_status < 200 || _status > 299) {
        const status = _status;
        let message: string | object;

        // @TODO
        if (response.headers.get('Content-Type').includes('json')) {
          message = await response.json();
        } else {
          message = await response.text();
        }

        // @TODO
        const body = JSON.stringify({
          method, path, status,
          message,
          timestamps: +new Date(),
        });
        const _errorResponse = new Response(body, {
          status, statusText,
          headers: response.headers,
        });

        // using new response;
        // @TODO 
        
        _errorResponse.headers.set('Content-Type', 'application/json');
        ctx.output.response = _errorResponse;

        // count fail
        ctx.state.requestCount.count('fail');

        // accesslog
        // const { target } = ctx.state;
        // const requestTime = +new Date() - ctx.state.requestStartTime;
        // this.logger.log(`<= ${method} ${path} ${status} +${requestTime} (target: ${target})`);
      }
    };
  }

  private useChangeRequestHeaders(): Middleware<Context> {
    return async (ctx, next) => {
      const originHeaders = ctx.input.request.headers;

      ctx.input.request.headers = omit(originHeaders, [
        'host', 'origin', 'referer', 'accept-encoding',
      ]);

      await next!();
    };
  }

  private useChangeResponseHeaders(): Middleware<Context> {
    return async (ctx, next) => {
      await next!();

      const response = ctx.output.response;
      const requestStartTime = ctx.state.requestStartTime;
      response.headers.set('X-Runtime', `${+new Date() - requestStartTime}`);
      
      // avoiding Zlib.zlibOnError
      response.headers.delete('content-encoding');
    };
  }
}