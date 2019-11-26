import {
  Headers,
  RequestOptions as ProxyConfig, 
  RequestOutput as ProxyOutput,
} from '@zoproxy/core';

export interface Config extends Omit<ProxyConfig, 'target'> {
  registry: string;
  method: string; // 'POST';
  endpoint: string;
  headers?: Headers;
}

export interface RequestInput {
  method: string;
  path: string;
  headers: Headers,
  body: any;
}

export interface RequestOptions extends ClientProxyAttributes {
  headers?: Headers;
}

export interface RequestOutput extends ProxyOutput {

}

/**
 * Client Request Proxy Body
 */
export interface ClientProxyRequest {
  method: string;
  path: string;
  headers: Headers;
  body: any;
}

/**
 * Client Request Proxy Attributes
 *  which usual Static
 */
export interface ClientProxyAttributes {
  // safe
  handshake: HandShake;

  // dynamic target, this only works when server enable using client target
  target?: string;
}

/**
 * Hand Shake Data
 */
export interface HandShake {
  // app <=> users
  // app
  appId?: string;
  appToken?: string;
  timestamps: number;
  // single user
  user?: any;
}


export interface ClientRequestBody {
  /**
   * Proxy Attributes, Static Data
   * @Notice DONOT SET DYNAMIC DATA HERE
   */
  attributes: ClientProxyAttributes;

  /**
   * Proxy Request Value
   * @Notice ONLY SET PROXY DATA, DONOT SET NO PROXY REQUEST DATA HERE
   */
  values: ClientProxyRequest;

  /**
   * timestamps
   */
  timestamps: number;
}
