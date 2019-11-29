import { Proxy, Response } from '@zoproxy/core';
import * as qs from '@zcorky/query-string';
import { Middleware, Context } from '@zodash/onion';
import { getLogger } from '@zodash/logger';

import {
  ProxyServerConfig,
  RequestBodyFromClient,
  RequestOptionsFromServer,
  RequestOutputFromTarget,
} from './interface';

const debug = require('debug')('@zoproxy/server');

const HANDSHAKE = Symbol('handshake');

export class ProxyServer {
  private core: Proxy;
  private logger = getLogger('zoproxy.server');
  private handshake: any;

  constructor(public readonly config: ProxyServerConfig) {
    this.core = new Proxy(this.config);

    this.core.use(this.useHandShake());
  }

  // target server, from client
  private getTarget(body: RequestBodyFromClient) {
    const { enableDynamicTarget } = this.config;
    // @TODO
    if (enableDynamicTarget && body && body.attributes && body.attributes.target) {
      return body.attributes.target;
    }

    return this.config.target;
  }

  // path to target server, from client
  private getPath(body: RequestBodyFromClient) {
    return body.values.path;
  }

  // method to target server, from client
  private getMethod(body: RequestBodyFromClient) {
    return body.values.method;
  }

  // headers to target server, from client
  private getHeaders(body: RequestBodyFromClient, options?: RequestOptionsFromServer) {
    return {
      ...body.values.headers,
      ...(options && options.headers),
      'User-Agent': 'ProxyServer/v0.0.0',
    };
  }

  // body to target server, from client
  private getBody(body: RequestBodyFromClient): any {
    const { handshake } = body.attributes;
    const { headers, body: _body } = body.values;

    // set handshake
    this.setHandShake(handshake);

    if (headers['Content-Type'] && headers['Content-Type'].includes('json')) {
      return JSON.stringify(_body);
    }

    if (headers['Content-Type'] && headers['Content-Type'].includes('form-data')) {
      return qs.stringify(_body);
    }

    return _body;
  }

  public async request(input: RequestBodyFromClient, options?: RequestOptionsFromServer): Promise<RequestOutputFromTarget> {
    const target = this.getTarget(input);

    const method = this.getMethod(input);
    const path = this.getPath(input);
    const headers = this.getHeaders(input, options);
    const body = JSON.stringify(this.getBody(input));

    console.log('yyy: ', input);

    this.logger.info('=>', method, path, '-', target);
    
    const { response, requestTime } = await this.core.request({
      target,
      method, path, headers, body,
    });
    
    this.logger.info('<=', method, path, response.status, `+${requestTime}ms`);

    // if (response.status >= 400 && response.status < 600) {
    //   const originBody = await response.json();
    //   const _body = JSON.stringify(originBody.message);

    //   const _errorResponse = new Response(_body, {
    //     status: response.status,
    //     statusText: response.statusText,
    //     headers: response.headers,
    //   });

    //   return _errorResponse;
    // }
    
    return response;
  }

  private useHandShake = () => {
    return async (ctx, next) => {
      // waitingHandleShake
      await this.config.onHandShake(this.getHandShake())

      await next!();
    };
  }

  private setHandShake(handshake: any) {
    this[HANDSHAKE] = handshake
  }

  private getHandShake() {
    return this[HANDSHAKE];
  }
}