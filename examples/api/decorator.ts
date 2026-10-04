// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import wrapper from './decoratorVars.js';

export default wrapper;

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void wrapper();
}
// --!
