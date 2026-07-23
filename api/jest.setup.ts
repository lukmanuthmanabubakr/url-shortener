import { config } from 'dotenv';
import { resolve } from 'path';

// Load host-reachable test env (localhost ports) before any module that reads
// process.env is imported. Keeps the Docker-internal .env untouched.
config({ path: resolve(__dirname, '.env.test') });
