import { Response } from 'node-fetch';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTION' | string;

export type Path = string;

/**
 * Request/Response Headers
 */
export type Headers = Record<string, string>;

// export type Query = any;

// export type Params = any;

export type Body = any;

export interface RequestInput {
  method: Method;
  path: Path;
  headers: Headers;
  body?: Body;
}

export interface RequestOutput extends Response {

}

export type Request = (input: RequestInput) => RequestOutput;

export interface RequestOptions {
  target: string;
  cache?: {
    // OK Request, s
    ok: number;

    // Status Error Request, s
    error: number;

    // Broken Request
    fatal: number;
  }
}