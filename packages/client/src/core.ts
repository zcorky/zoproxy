import * as assert from 'assert';
import { Proxy } from '@zoproxy/core';
import { Response } from 'node-fetch';

import { ProxyClientConfig, RequestInput, RequestOptions, RequestOutput, ClientRequestBody } from './interface';

const debug = require('debug')('datahub.client');

export class ProxyClient {
  private core = new Proxy({ ...this.config, target: this.config.registry });
  // private logger = getLogger('datahub.client');

  constructor(public readonly config: ProxyClientConfig) {

  }

  // path to registry
  private getPath() {
    assert(this.config.registry, 'registry is required');
    assert(this.config.endpoint, 'endpoint is required');

    const { endpoint } = this.config;
    return endpoint;
  }

  // method to registry
  private getMethod() {
    return 'POST';
  }

  // headers to registry
  private getHeaders() {
    return {
      ...this.config.headers,
      'User-Agent': 'ProxyClient/v0.0.0',
      'Content-Type': 'application/json',
    };
  }

  // proxy data to registry
  //  => { attributes: { handshake, target }, values: { method path headers body }, timestamps }
  private getBody(body: RequestInput, options: RequestOptions): ClientRequestBody {
    const attributes = {
      handshake: options.handshake,
      target: options.target,
    };

    const values = {
      ...body,
      method: body.method || 'GET',
      headers: {
        // browser request headers
        ...body.headers,
        // request method option headers
        ...options.headers,
      },
    };

    const timestamps = +new Date();

    return { attributes, values, timestamps };
  }

  public async request(input: RequestInput, options: RequestOptions): Promise<RequestOutput> {
    const method = this.getMethod();
    const path = this.getPath();
    const headers = this.getHeaders();
    const body = JSON.stringify(this.getBody(input, options));

    const response = await this.core.request({ method, path, headers, body });
    
    if (response.status >= 400 && response.status < 600) {
      const originBody = await response.json();
      
      // the real method and path
      const { method, path } = input;
      const _body = JSON.stringify({ ...originBody, method, path });

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