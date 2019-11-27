import { Proxy, Response } from '@zoproxy/core';
import * as qs from '@zcorky/query-string';
import { getLogger } from '@zodash/logger';

import {
  ProxyServerConfig,
  RequestBodyFromClient,
  RequestOptionsFromServer,
  RequestOutputFromTarget,
} from './interface';

const debug = require('debug')('@zoproxy/server');

export class ProxyServer {
  private core = new Proxy(this.config);
  private logger = getLogger('zoproxy.server');

  constructor(public readonly config: ProxyServerConfig) {}

  // target server, from client
  private getTarget(body: RequestBodyFromClient) {
    const { enableDynamicTarget } = this.config;
    if (enableDynamicTarget && body.attributes.target) {
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
    const { headers, body: _body } = body.values;

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

    this.logger.info('=>', method, path, '-', target);
    
    const { response, requestTime } = await this.core.request({
      target,
      method, path, headers, body,
    });
    
    this.logger.info('<=', method, path, response.status, `+${requestTime}ms`);

    if (response.status >= 400 && response.status < 600) {
      const originBody = await response.json();
      const _body = JSON.stringify(originBody.message);

      const _errorResponse = new Response(_body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      return _errorResponse;
    }
    
    return response;
  }
}