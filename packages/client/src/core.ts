import * as assert from 'assert';
import { Proxy, Response } from '@zoproxy/core';
import { getLogger } from '@zodash/logger';

import { ProxyClientConfig, RequestInput, RequestOptions, RequestOutput, ClientRequestBody } from './interface';

const debug = require('debug')('@zoproxy/client');

export class ProxyClient {
  private core = new Proxy(this.config);
  private logger = getLogger('zoproxy.client');

  constructor(public readonly config: ProxyClientConfig) {

  }

  private getRegistry() {
    return this.config.registry;
  }

  private getDataTarget(requestOptions?: RequestOptions) {
    const { registry, enableDynamicTarget } = this.config;
    const { target: _dynamicTarget } = requestOptions || {};

    if (enableDynamicTarget && _dynamicTarget) {
      return _dynamicTarget;
    }

    return `decided by ${registry}`
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
  private getHeaders(options: RequestOptions) {
    return {
      ...this.config.headers,
      ...options.serverHeaders,
      'User-Agent': 'ProxyClient/v0.0.0',
      'Content-Type': 'application/json',
    };
  }

  // proxy data to registry
  //  => { attributes: { handshake, target }, values: { method path headers body }, timestamps }
  private getBody(body: RequestInput, options: RequestOptions): ClientRequestBody {
    const attributes = {
      handshake: options.handshake,
      target: this.config.enableDynamicTarget && options.target || undefined, // @TODO only enable target will allow target, or null
    };

    const values = {
      ...body,
      method: body.method || 'GET',
      headers: {
        // browser request headers
        ...body.headers,
        // request method option headers
        ...options.dataHeaders,
      },
    };

    const timestamps = +new Date();

    return { attributes, values, timestamps };
  }

  public async request(input: RequestInput, options: RequestOptions): Promise<RequestOutput> {
    const registry = this.getRegistry();

    const dataTarget = this.getDataTarget(options);
    const method = this.getMethod();
    const path = this.getPath();
    const headers = this.getHeaders(options);
    const body = JSON.stringify(this.getBody(input, options));

    this.logger.info('=>', input.method, input.path, '-', dataTarget);

    const {
      response,
      requestTime,
    } = await this.core.request({
      target: registry, // registry
      method, path, headers, body,
    });

    this.logger.info('<=', input.method, input.path, response.status, `+${requestTime}ms`);
    
    // if (response.status >= 400 && response.status < 600) {
    //   const originBody = await response.json();
      
    //   // the real method and path
    //   const { method, path } = input;
    //   const _body = JSON.stringify(originBody); // JSON.stringify({ ...originBody, method, path });

    //   const _errorResponse = new Response(_body, {
    //     status: response.status,
    //     statusText: response.statusText,
    //     headers: response.headers,
    //   });

    //   return _errorResponse;
    // }

    return response;
  }
}