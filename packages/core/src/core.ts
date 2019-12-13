import * as fs from 'fs';
import { Response, Headers } from 'node-fetch';
import { Onion, Middleware, Context } from '@zodash/onion';
// import { getLogger } from '@zodash/logger';
import LRU from '@zcorky/lru';
import { md5 } from '@zodash/crypto/lib/md5';
import { omit } from '@zodash/omit';

import * as qs from '@zcorky/query-string';
import * as FormData from 'form-data';

import { request } from './utils/request';

import {
  Config,
  RequestInput, RequestOutput,
} from './interface';

import { getTarget } from './utils/get-target';
import { getUrl } from './utils/get-url';
import { getBody } from './utils/get-body';

const debug = require('debug')('@zoproxy/core');

export interface Input  {
  request: RequestInput;
}

export interface Output extends RequestOutput {

}

export interface State {
  readonly requestStartTime: number;
  readonly requestCount: { all: number, fail: number, count(type: 'all' | 'fail'): void };
  readonly requestCache: LRU<string, RequestOutput>;
  readonly target: string;

  requestTime: number;

  md5Key: string;
}

/**
 * Export Response
 */
export {
  Response,
};

export class Proxy extends Onion<Input, Output, State> {
  constructor(public readonly config: Config) {
    super();

    this.setup();
  }

  public handle(): Middleware<Context<Input, Output, State>> {
    return async (ctx) => {
      const { method, path, headers, body: _body } = ctx.input.request;

      const url = getUrl(path, ctx.state.target);
      const body = getBody(_body, method);

      // debug('=>', method, url);
      // console.log('core: ', method, url, headers, typeof _body, _body);

      const response = await request(url, {
        method,
        headers,
        body,
      });

      // debug('<=', method, url, response.status);

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
    // 0.copy context state to output
    this.use(this.useCopyStateToOutput());
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
    // 9.content-type
    // 9.1 json
    // ignore
    // 9.2 x-www-form-urlencoded - query-string
    this.use(this.useModifyBodyByUrlencoded());
    // 9.3 form-data - FormData
    this.use(this.useModifyBodyByFormData());
  }

  private useCopyStateToOutput(): Middleware<Context<Input, Output, State>> {
    return async (ctx, next) => {
      await next();

      // requestTime
      ctx.output.requestTime = ctx.state.requestTime;
    };
  }

  private useRequestTime(): Middleware<Context<Input, Output, State>> {
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

  private useFinalTarget(): Middleware<Context<Input, Output, State>> {
    return async (ctx, next) => {
      const { target } = ctx.input.request;

      // set target
      (ctx.state as any).target = getTarget(target);

      await next!();
    };
  }

  private useRecordAccess(): Middleware<Context<Input, Output, State>> {
    return async (ctx, next) => {
      const { target } = ctx.state;
      const { method, path } = ctx.input.request;

      debug(`=> ${method} ${path} (target: ${target})`);
      debug(ctx.input);

      await next!();

      const { status } = ctx.output.response;
      const requestTime = +new Date() - ctx.state.requestStartTime;
      
      debug(`<= ${method} ${path} ${status} +${requestTime} (target: ${target})`);
      debug(ctx.output);
    };
  }

  private useCountRequest(): Middleware<Context<Input, Output, State>> {
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
        debug(
          'Gateway:', ctx.state.target || 'None',
          'Count:', `${requestCount.all}/${requestCount.fail}`);
    
        cache.set(tickKey, true, { maxAge: 10000 });
      }

      await next!();
    };
  }
  
  private useCache(): Middleware<Context<Input, Output, State>> {
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
            debug(`${method} ${path} ${(cachedRequestOutput as any).status} +${requestTime} (hit cache)`);
  
            throw cachedRequestOutput;
          }
  
          debug(`${method} ${path} ${cachedRequestOutput.response.status} +${requestTime} (hit cache)`);
          
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

  private useCatchError(): Middleware<Context<Input, Output, State>> {
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
        debug(`${method} ${path} ${error.status} (Gateway Status Error)`);
        debug(error);

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

  private useStatusError(): Middleware<Context<Input, Output, State>> {
    return async (ctx, next) => {
      await next!();

      // const { method, path } = ctx.input.request;
      // const response = ctx.output.response;
      // const { status: _status, statusText } = response;

      // if (_status < 200 || _status > 299) {
      //   // count fail
      //   ctx.state.requestCount.count('fail');

      //   const status = _status;
      //   let message: string | object;

      //   // @TODO
      //   const contentType = response.headers.get('Content-Type');
      //   if (contentType && contentType.includes('json')) {
      //     // message = await response.json();
      //     ctx.output.response = response.clone();
      //     return ;
      //   } else {
      //     message = await response.text();
      //   }

      //   // @TODO
      //   const body = JSON.stringify({
      //     method, path, status,
      //     message,
      //     timestamps: +new Date(),
      //   });

      //   console.log('body: ', body);
        
      //   const _errorResponse = new Response(body, {
      //     status, statusText,
      //     headers: response.headers,
      //   });

      //   // using new response;
      //   // @TODO 
        
      //   _errorResponse.headers.set('Content-Type', 'application/json');
      //   ctx.output.response = _errorResponse;

      //   // accesslog
      //   // const { target } = ctx.state;
      //   // const requestTime = +new Date() - ctx.state.requestStartTime;
      //   // debug(`<= ${method} ${path} ${status} +${requestTime} (target: ${target})`);
      // }
    };
  }

  private useChangeRequestHeaders(): Middleware<Context<Input, Output, State>> {
    return async (ctx, next) => {
      const originHeaders = ctx.input.request.headers;

      ctx.input.request.headers = omit(originHeaders, [
        'host', 'origin', 'referer', 'accept-encoding',
      ]);

      await next!();
    };
  }

  private useChangeResponseHeaders(): Middleware<Context<Input, Output, State>> {
    return async (ctx, next) => {
      await next!();

      const response = ctx.output.response;
      const requestStartTime = ctx.state.requestStartTime;
      response.headers.set('X-Runtime', `${+new Date() - requestStartTime}`);
      
      // advoiding HPE_UNEXPECTED_CONTENT_LENGTH
      // stackoverflow: https://stackoverflow.com/questions/35525715/http-get-parse-error-code-hpe-unexpected-content-length
      response.headers.delete('transfer-encoding');
      // avoiding Zlib.zlibOnError
      response.headers.delete('content-encoding');
    };
  }

  // 9.2 x-www-form-urlencoded - query-string
  private useModifyBodyByUrlencoded(): Middleware<Context<Input, Output, State>> {
    return async (ctx, next) => {
      const { headers, body } = ctx.input.request;
      // already encoded string
      if (!body) {
        return next!();
      }

      const _body = safeParseBody(body as string);

      //
      const _headers = new Headers(headers);
      const contentType = _headers.get('Content-Type');
      if (_body && contentType && contentType.includes('application/x-www-form-urlencoded')) {
        ctx.input.request.body = qs.stringify(_body);
      }

      await next!();
    };
  }

  // 9.3 form-data - FormData
  private useModifyBodyByFormData(): Middleware<Context<Input, Output, State>> {
    return async (ctx, next) => {
      const { headers, body, files } = ctx.input.request;
      // already encoded string
      if (!body) {
        return next!();
      }

      const _body = safeParseBody(body as string);

      //
      const _headers = new Headers(headers);
      const contentType = _headers.get('Content-Type');
      if (_body && contentType && contentType.includes('multipart/form-data')) {
        // remove origin form-data type
        _headers.delete('Content-Type');

        // @TODO this will change headers type
        // ctx.input.request.headers = _headers as any;
        const n_headers = {};
        for (const [key, value] of _headers.entries() as any) {
          n_headers[key] = value;
        }

        ctx.input.request.headers = n_headers;
        ctx.input.request.body = jsonToFormData(_body, files);
      }

      await next!();
    };
  }
}

function safeParseBody(body: string) {
  try {
    return JSON.parse(body);
  } catch (error) {

  }
}

function jsonToFormData(json: Record<string, any>, files?: object) {
  const formData = new FormData();

  for (const key in json) {
    const value = json[key];
    formData.append(key, value);
  }

  if (files) {
    for (const key in files) {
      const file = files[key];
      formData.append(key, fs.createReadStream(file.path), {
        filename: file.name,
        contentType: file.type,
      });
    }
  }

  return formData;
}