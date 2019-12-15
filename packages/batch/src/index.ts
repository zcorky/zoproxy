import { Proxy, Config, RequestInput } from '@zoproxy/core';
import { getLogger } from '@zodash/logger';
import { stringify } from '@zcorky/query-string';

import {
  PathRewriterBatchInput, PathRewriterInputOptions, createPathRewriterBatch,
} from './utils/path-rewrite';

export interface Options extends Config, PathRewriterInputOptions {
  table: PathRewriterBatchInput;
}

const logger = getLogger('zoproxy.batch');

export type Input = Omit<RequestInput, 'target'> & {
  query: string | Record<string, any>;
};

export function createProxy(options: Options) {
  const proxy = new Proxy(options);
  const rewrite = createPathRewriterBatch(options.table);

  return async (input: Input) => {
    const _pathAndTarget = rewrite(input.path);

    // not found
    if (_pathAndTarget === null) {
      const error = new Error('None Matched');
      (error as any).status = 404;
      throw error;
    }

    const { method, query } = input;
    const { target, path } = _pathAndTarget;

    const finalPath = !query
      ? path : typeof query === 'string'
        ? `${path}?${query}` : stringify(query);

    logger.info('=>', method, _pathAndTarget.path, '-', target);
    
    const res = await proxy.request({
      ...input,
      target,
      path: finalPath,
    });
    
    logger.info('<=', method, _pathAndTarget.path, res.response.status, `+${res.requestTime}ms`);

    return res;
  }
}
