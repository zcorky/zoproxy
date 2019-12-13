import { Response } from 'node-fetch';
import * as FormData from 'form-data';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTION' | string;

export type Path = string;

/**
 * Request/Response Headers
 */
export type Headers = Record<string, string>;

// export type Query = any;

// export type Params = any;

export type Body = string | FormData;

export interface RequestInput {
  method: Method;
  path: Path;
  headers: Headers;
  body?: Body;
  files?: any;

  // only works when enableDynamicTarget
  target: string;
}

export interface RequestOutput {
  response: Response;
  requestTime: number;
}

export type Request = (input: RequestInput) => RequestOutput;

export interface Config {
  /**
   * target server
   *  @removed, should not use target in config
   *    the target should be dynamic automatically
   */
  // target: string;

  cache?: {
    // OK Request, s
    ok: number;

    // Status Error Request, s
    error: number;

    // Broken Request
    fatal: number;
  };
}

// /* Export node-fetch Response */
// export type Response = Response;