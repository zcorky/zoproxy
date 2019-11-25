const NO_BODY_METHODS = ['GET', 'HEAD'];

export function getBody(body: any, method: string) {
  if (NO_BODY_METHODS.includes(method)) {
    return undefined;
  }

  return body;
}