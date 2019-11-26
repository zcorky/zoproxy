export function getTarget(target: string, dynamicTarget: string, enableDynamicTarget: boolean): string {
  if (enableDynamicTarget && dynamicTarget) {
    return dynamicTarget;
  }

  return target;
}