import * as fs from 'fs';
import * as path from 'path';
import {debug, enableDebug} from '../utils';
import DocsBuilder from '../builder/DocsBuilder';
import {formatDuration} from '../utils/formatting';

export interface ICplaceJSDocsConfig {
    /**
     * Repos to build documentation for
     */
    repos: string;

    /**
     * Destination for generated output
     */
    destination: string;
    /**
     * Enable debug logging
     */
    debug?: boolean;

    /**
     * use *.d.ts and typedoc for generating docs instead of *.js / JSDoc
     */
    useTypescript?: boolean;
}

export class CplaceJSDocs {
    public static readonly CPLACE_REPO_NAME = 'main';
    public static readonly CPLACE_REPO_ALT_NAME = 'cplace';
    public static readonly PLATFORM_PLUGIN_NAME = 'cf.cplace.platform';
    public static readonly DESCRIPTOR_FILE_NAME = 'pluginDescriptor.json';

    private readonly plugins: Map<string, string>;

    constructor(private readonly buildConfig: ICplaceJSDocsConfig) {
        if(buildConfig.debug) {
            enableDebug();
        }
        this.plugins = this.setup(buildConfig);
        console.log(`(CplaceJSDocs) Configured for repos ${buildConfig.repos} - useTypescript? ${buildConfig.useTypescript}`)
    }

    public async build(): Promise<void> {
        if (!this.plugins.size) {
            console.log('No plugins with cplaceJS docs found');
            return new Promise<void>(resolve => resolve());
        }

        const mainRepoPath = this.getMainRepoPath();
        if (mainRepoPath === null) {
            debug(`(CplaceJSDocs) Main repo cannot be found...`);
            return new Promise<void>((resolve, reject) => reject(
                'Main repo cannot be found...'
            ));
        }

        const startTime = new Date().getTime();
        console.log(`(CplaceJSDocs) Found ${this.plugins.size} plugins with jsdoc: ${Array.from(this.plugins.keys()).join(', ')}`);
        const docsBuilder = new DocsBuilder(this.plugins, this.buildConfig.destination, !!this.buildConfig.useTypescript);
        await docsBuilder.start();
        const endTime = new Date().getTime();
        console.log(`CplaceJS docs built successfully (${formatDuration(endTime - startTime)})`)
    }

    private setup(buildConfig: ICplaceJSDocsConfig): Map<string, string> {
        let repoPaths: Set<string>;
        const plugins = new Map<string, string>();
        const mainRepoPath = this.getMainRepoPath();
        if (mainRepoPath === null) {
            console.error(`(CplaceJSDocs) Main repo cannot be found...`);
            process.exit(1);
        }

        debug(`(CplaceJSDocs) Building cplaceJS docs for all repos... `);
        repoPaths = this.getAllPotentialRepos()

        repoPaths.forEach(repoPath => {
            const files = fs.readdirSync(repoPath);
            files.forEach(file => {
                const filePath = path.join(repoPath, file);
                if (fs.lstatSync(filePath).isDirectory() || fs.lstatSync(filePath).isSymbolicLink()) {
                    const potentialPluginName = path.basename(file);
                    if (CplaceJSDocs.directoryLooksLikePlugin(filePath) && CplaceJSDocs.pluginHasCplaceJSDocs(filePath, buildConfig)) {
                        plugins.set(potentialPluginName, filePath);
                    }
                }
            });
        });

        return plugins;
    }

    private getAllPotentialRepos(): Set<string> {
        const repos = new Set<string>();
        const mainRepoPath = this.getMainRepoPath();
        if (mainRepoPath != null) {
            const containingDir = path.resolve(path.join(mainRepoPath, '..'));
            const files = fs.readdirSync(containingDir);
            files.forEach(file => {
                const filePath = path.join(containingDir, file);
                if (fs.lstatSync(filePath).isDirectory() || fs.lstatSync(filePath).isSymbolicLink()) {
                    repos.add(filePath);
                }
            });
        }
        return repos;
    }

    private getRepoRoot() {
        return this.buildConfig.repos;
    }

    private getMainRepoPath(): string | null {
        let mainRepoPath;
        mainRepoPath = path.resolve(path.join(this.getRepoRoot(), CplaceJSDocs.CPLACE_REPO_NAME));
        // if repo is checked out as cplace
        if (!fs.existsSync(mainRepoPath)) {
            mainRepoPath = path.resolve(path.join(this.getRepoRoot(), CplaceJSDocs.CPLACE_REPO_ALT_NAME));
        }
        if (!fs.existsSync(path.join(mainRepoPath, CplaceJSDocs.PLATFORM_PLUGIN_NAME))) {
            return null;
        }

        return mainRepoPath;
    }

    private static directoryLooksLikePlugin(pluginPath: string): boolean {
        return fs.existsSync(path.join(pluginPath, 'src'));
    }

    private static pluginHasCplaceJSDocs(pluginPath: string, buildConfig: ICplaceJSDocsConfig): boolean {
        const docsPath = path.join(pluginPath, 'assets', 'cplaceJS');
        let hasCplaceJSDocs = fs.existsSync(docsPath) && fs.lstatSync(docsPath).isDirectory() && !buildConfig.useTypescript;
        if (!hasCplaceJSDocs) {
            const alternativeDocsPath = path.join(pluginPath, 'src', 'main', 'resources', 'cplaceJS');
            hasCplaceJSDocs = fs.existsSync(alternativeDocsPath) && fs.lstatSync(alternativeDocsPath).isDirectory();
        }
        return hasCplaceJSDocs;
    }
}