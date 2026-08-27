#!/usr/bin/env node
import { BzCLI } from '../bzCLI.js';

const cli = new BzCLI();
await cli.run();
