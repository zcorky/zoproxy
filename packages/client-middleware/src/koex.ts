import { Middleware, Context } from '@koex/core';
import {
  ProxyClient,
  ProxyClientConfig,
  HandShake,
  RequestOptions,
} from '@zoproxy/client';

const assert = require('assert');

declare module '@koex/core' {
  export interface Context {
    readonly proxyClient: ProxyClient;
  }
}

export interface Options extends ProxyClientConfig {
  handshake: HandShake;
  clientEndpoint: string;
  //
  serverHeaders?: RequestOptions['serverHeaders'] | ((ctx: Context) => Promise<RequestOptions['serverHeaders']>);
  dataHeaders?: RequestOptions['dataHeaders'] | ((ctx: Context) => Promise<RequestOptions['dataHeaders']>);
}

export function createProxyClient(options: Options): Middleware<Context> {
  const proxy = new ProxyClient(options);

  return async (ctx, next) => {
    /**
     * assign proxy
     */
    Object.defineProperty(ctx, 'proxyClient', {
      get() {
        return proxy;
      },
      enumerable: false,
    });

    if (!ctx.path.startsWith(options.clientEndpoint)) {
      return await next();
    }

    assert((ctx.request as any).body, 'ctx.request.body is undefined, make sure you have using body parser middleware.');

    const serverHeaders = typeof options.serverHeaders === 'function'
      ? await options.serverHeaders(ctx) : options.serverHeaders;
    const dataHeaders = typeof options.dataHeaders === 'function'
      ? await options.dataHeaders(ctx) : options.dataHeaders;

    const response = await proxy.request({
      method: ctx.method,
      path: ctx.path.replace(options.clientEndpoint, ''), // @TODO
      headers: ctx.headers,
      body: (ctx.request as any).body,
    }, {
      handshake: {
        ...options.handshake,
        timestamps: +new Date(),
      },
      serverHeaders,
      dataHeaders,
    });
  
    ctx.set(response.headers.raw() as any);
    ctx.body = response.body;
  }
}

export default createProxyClient;