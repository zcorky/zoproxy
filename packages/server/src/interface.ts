import {
  Headers,
  Config, 
  // RequestOutput as ProxyOutput,
  Response,
} from '@zoproxy/core';

export interface ProxyServerConfig extends Config {
  // client <=> server
  method: string; // 'POST';
  endpoint: string;

  // server => origin data server
  target: string;
  headers?: Headers;
  // target: string;

  // handshake
  onHandShake: HandShakeMethod;

  // dynamic target, enable client request with target
  enableDynamicTarget?: boolean;
}

export interface RequestInput {
  method: string;
  path: string;
  headers: Headers,
  body: any;
}

export interface RequestOptionsFromServer extends ProxyAttributesFromClient {
  headers?: Headers;
}

export interface RequestOutputFromTarget extends Response {

}

/**
 * Client Request Proxy Body
 */
export interface ProxyRequestFromClient {
  method: string;
  path: string;
  headers: Headers;
  body: any;
}

/**
 * Client Request Proxy Attributes
 *  which usual Static
 */
export interface ProxyAttributesFromClient {
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

/**
 * ProxyServer Hand Shake Method
 *  using for:
 *    1 authentication
 *    2 permission
 *    3 rate limit
 * 
 *  how to:
 *    if not validate, throw error with status and message
 */
export type HandShakeMethod = (handshake?: HandShake) => Promise<void>;

export interface RequestBodyFromClient {
  /**
   * Proxy Attributes, Static Data
   * @Notice DONOT SET DYNAMIC DATA HERE
   */
  attributes: ProxyAttributesFromClient;

  /**
   * Proxy Request Value
   * @Notice ONLY SET PROXY DATA, DONOT SET NO PROXY REQUEST DATA HERE
   */
  values: ProxyRequestFromClient;

  /**
   * timestamps
   */
  timestamps: number;
}
