/**
 * Path Rewriter
 */

export interface PathRewriterInput {
  target: string;
  changeOrigin?: boolean;
  pathRewrite: Record<string, string>;
  env?: Record<string, PathRewriterInput>;
}

export interface PathRewriterInputOptions {
  env?: string;
}

export type PathRewriterOutput = (path: string) => {
  target: string;
  path: string;
} | null;

/**
 * Create Path Rewriter (One)
 * 
 * @param input { target, pathRewrite }
 * @param options { env }
 * @return (path: string) => newPath(string) or null
 */
export function createPathRewriter(input: PathRewriterInput, options?: PathRewriterInputOptions): PathRewriterOutput {
  const { env } = options || {}
  const { env: fromEnv = {}, ...base } = input;

  if (env && fromEnv[env]) {
    const extended = fromEnv[env];

    for (const key in extended) {
      if (typeof extended[key] !== 'undefined') {
        base[key] = extended[key];
      }
    }
  }

  const { target, pathRewrite = {} } = base;

  return (path: string) => {
    for (const key in pathRewrite) {
      const re = new RegExp(key);
      if (re.test(path)) {
        return {
          target,
          path: path.replace(re, pathRewrite[key]),
        };
      }
    }

    return null;
  };
}

export type PathRewriterBatchInput = Record<string, PathRewriterInput>;

export type PathRewriterBatchInputOptions = PathRewriterInputOptions;

export type PathRewriterBatchOutput = PathRewriterOutput;

/**
 * Create Path Rewriter (Batch)
 * 
 * @param input Record<string, { target, pathRewrite }>
 * @param options { env }
 * @return (path: string) => newPath(string) or null
 */
export function createPathRewriterBatch(input: PathRewriterBatchInput, options?: PathRewriterBatchInputOptions): PathRewriterOutput {
  const matches = Object.keys(input)
    .map(key => {
      return {
        re: new RegExp(key),
        writer: createPathRewriter(input[key], options),
      };
    });

  return (path: string) => {
    for (const { re, writer } of matches) {
      if (re.test(path)) {
        return writer(path);
      }
    }

    return null;
  };
}