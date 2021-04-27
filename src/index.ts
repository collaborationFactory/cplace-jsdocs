#!/usr/bin/env node

import meow from 'meow'
import {CplaceJSDocs, ICplaceJSDocsConfig} from './model/CplaceJSDocs';
import {cerr, debug, enableDebug} from './utils';


run();

function run() {
    const cli = meow(`
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
        enableDebug();
        debug('Debugging enabled...');
    }

    if (cli.flags.repos != null && !cli.flags.repos) {
        debug('No repos specified. Using all available repos');
    }

    if (cli.flags.out != null && !cli.flags.out) {
        debug('No output path provided. Using default path');
    }

    const config: ICplaceJSDocsConfig = {
        repos: cli.flags.repos,
        destination: cli.flags.out || '',
    };

    config.repos = '/Users/pragatisureka/software/collaboration-factory/repos';
    config.destination = '/Users/pragatisureka/jsdocs';
    config.debug = true;

    try {
        const docsBuilder = new CplaceJSDocs(config);
        process.on('SIGTERM', () => {
            debug('Shutting down...');
        });

        // Timeout to ensure flush of stdout
        docsBuilder.build().then(() => {
            setTimeout(() => process.exit(0), 200);
        }, () => {
            setTimeout(() => process.exit(1), 200);
        });
    } catch (err) {
        console.log(err);
        console.error(cerr`Failed to build docs: ${err.message}`);
    }
}

