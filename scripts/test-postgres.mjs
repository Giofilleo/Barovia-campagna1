import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','tests/campaign-api.test.mjs'],{stdio:'inherit',env:{...process.env,TEST_DATABASE:'postgres'}});
process.exitCode=result.status??1;
