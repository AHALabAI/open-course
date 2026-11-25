import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const dir=fileURLToPath(new URL('.',import.meta.url));
const args=['--edition=2021','--target','wasm32-unknown-unknown','--crate-type','cdylib','-O','-C','panic=abort','-C','strip=symbols','measurement.rs','-o','measurement.wasm'];
const build=spawnSync('rustc',args,{cwd:dir,stdio:'inherit'});
if(build.status!==0)throw Error(build.error?.message??'rustc build failed');
const bytes=readFileSync(new URL('measurement.wasm',import.meta.url));
writeFileSync(new URL('measurement-bytes.js',import.meta.url), 'globalThis.measurementWasmBase64='+JSON.stringify(bytes.toString('base64'))+';\n');
