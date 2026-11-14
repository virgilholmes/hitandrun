import { test } from 'node:test';
import { runChecks } from './checks.mjs';
test('Pure3D bounds, endianness, ownership and geometry decoding', () => { runChecks(); });
