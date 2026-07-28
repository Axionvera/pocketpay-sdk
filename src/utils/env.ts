/**
* Safely checks if the code is running in a Node.js environment.
*
* Uses `typeof process` and `process.versions.node` to avoid ReferenceErrors
* in browser environments where `process` is undefined.
*
* @returns true if running in Node.js, false otherwise
*/
export function isNode(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * Safely checks if the code is running in a standard browser environment.
 *
 * Checks for the presence of the `window` and `document` objects.
 *
 * @returns true if running in a browser, false otherwise
 */
export function isBrowser(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as any).window !== 'undefined' &&
    typeof (globalThis as any).document !== 'undefined'
  );
}

/**
 * Safely checks if the code is running in a React Native environment.
 *
 * Checks if `navigator.product` is 'ReactNative' without causing ReferenceErrors
 * if `navigator` is undefined.
 *
 * @returns true if running in React Native, false otherwise
 */
export function isReactNative(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as any).navigator !== 'undefined' &&
    (globalThis as any).navigator.product === 'ReactNative'
  );
}