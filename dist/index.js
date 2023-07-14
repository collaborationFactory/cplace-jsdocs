#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const meow_1 = __importDefault(require("meow"));
const CplaceJSDocs_1 = require("./model/CplaceJSDocs");
const utils_1 = require("./utils");
run();
function run() {
    const cli = (0, meow_1.default)(`
    Usage:
        $ cplacejs-docs
        
    Options:
        --repos, -r <repos>     Root directory of the repos
        -out, -o                Output path for the docs
        --upload, -u            Upload generated files to docs server requires your public key to be added on the server
        --verbose, -v           Enable verbose logging
        --localOnly, -l         Build docs only for repo the script is executed in. Other repos will not be scanned for doc files
        --html                  Output result as static html files. By default Markdown files are generated    
        
    `, {
        flags: {
            repos: {
                type: 'string',
                alias: 'r',
                default: null
            },
            out: {
                type: 'string',
                alias: 'o',
                default: null
            },
            html: {
                type: 'boolean',
                alias: 'h',
                default: false
            },
            upload: {
                type: 'boolean',
                alias: 'u',
                default: false
            },
            verbose: {
                type: 'boolean',
                alias: 'n',
                default: false
            },
            localOnly: {
                type: 'boolean',
                alias: 'l',
                default: false
            }
        }
    });
    if (cli.flags.verbose) {
        (0, utils_1.enableDebug)();
        (0, utils_1.debug)('Debugging enabled...');
    }
    if (cli.flags.repos != null && !cli.flags.repos) {
        (0, utils_1.debug)('No repos specified. Using all available repos');
    }
    if (cli.flags.out != null && !cli.flags.out) {
        (0, utils_1.debug)('No output path provided. Using default path');
    }
    const config = {
        repos: cli.flags.repos,
        destination: cli.flags.out || '',
    };
    try {
        const docsBuilder = new CplaceJSDocs_1.CplaceJSDocs(config);
        process.on('SIGTERM', () => {
            (0, utils_1.debug)('Shutting down...');
        });
        // Timeout to ensure flush of stdout
        docsBuilder.build().then(() => {
            setTimeout(() => process.exit(0), 200);
        }, () => {
            setTimeout(() => process.exit(1), 200);
        });
    }
    catch (err) {
        console.log(err);
        console.error((0, utils_1.cerr) `Failed to build docs: ${err.message}`);
    }
}
