import { Proxy } from '@zoproxy/core';
import { Response } from 'node-fetch';
import * as qs from '@zcorky/query-string';

import {
  ProxyServerConfig,
  RequestBodyFromClient,
  RequestOptionsFromServer,
  RequestOutputFromTarget,
} from './interface';

const debug = require('debug')('datahub.client');

export class ProxyServer {
  private core = new Proxy(this.config);
  // private logger = getLogger('datahub.client');

  constructor(public readonly config: ProxyServerConfig) {}

  // target server, from client
  private getTarget(body: RequestBodyFromClient) {
    return body.attributes.target;
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

    const response = await this.core.request({
      target,
      method, path, headers, body,
    });
    
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