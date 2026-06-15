export function isResolvableAssetUrl(value: string): boolean {
  return (
    !value.startsWith("#") &&
    !value.startsWith("data:") &&
    !value.startsWith("blob:") &&
    !value.startsWith("http://") &&
    !value.startsWith("https://")
  );
}
