import * as assert from 'assert';
import { Proxy } from '@zoproxy/core';
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
  private getHeaders(input: RequestInput, options: RequestOptions) {
    if (this.isFormData(input)) {
      return {
        ...this.config.headers,
        ...options.serverHeaders,
        'User-Agent': 'ProxyClient/v0.0.0',
        'Content-Type': 'multipart/form-data',
      }; 
    }

    return {
      ...this.config.headers,
      ...options.serverHeaders,
      'User-Agent': 'ProxyClient/v0.0.0',
      'Content-Type': 'application/json',
    };
  }

  // proxy data to registry
  //  => { attributes: { handshake, target }, values: { method path headers body }, timestamps }
  private getBody(body: RequestInput, options: RequestOptions): string {
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
      // remove invalid body on request method
      body: !body.method || ['GET', 'HEAD'].includes(body.method) ? undefined : body.body,
    };

    const timestamps = +new Date();

    const data: ClientRequestBody = { attributes, values, timestamps };

    if (!this.isFormData(body)) {
      return JSON.stringify(data);
    }

    return JSON.stringify({
      'formData': JSON.stringify(data),
    });
  }

  public async request(input: RequestInput, options: RequestOptions): Promise<RequestOutput> {
    const registry = this.getRegistry();

    const dataTarget = this.getDataTarget(options);
    const method = this.getMethod();
    const path = this.getPath();
    const headers = this.getHeaders(input, options);
    const body = this.getBody(input, options);
    const files = input.files;

    this.logger.info('=>', input.method, input.path, '-', dataTarget);

    const {
      response,
      requestTime,
    } = await this.core.request({
      target: registry, // registry
      method, path, headers, body, files,
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

  public isFormData(input: RequestInput) {
    const contentType = input.headers['content-type'];
    return contentType && contentType.includes('multipart/form-data');
  }
}