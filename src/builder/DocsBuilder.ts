// create temporary working directory
import * as os from 'os';
import {debug} from '../utils';
import * as path from 'path';
import * as fs from 'fs';
import {existsSync, lstatSync, readdirSync, readFileSync, writeFileSync} from 'fs';
import * as rimraf from 'rimraf';
import {copySync, ensureDirSync, mkdirpSync, outputFileSync} from 'fs-extra';
import jsdoc2md from 'jsdoc-to-markdown';
import classTemplate from '../dmd-ext/templates/tmpl-class';
import namespaceTemplate from '../dmd-ext/templates/tmpl-namespace';
import typedefTemplate from '../dmd-ext/templates/tmpl-typedef';
import frontMatterTemplate from "../dmd-ext/templates/tmpl-fromtMatter";
import {generateLinks, groupData} from './BuilderUtils';
import '../dmd-ext/helper/helpers'
import {PluginMetaData} from "./constants";
import {resolve} from "path";

interface JsdocPaths {
    sourceDir: string;
    jsdocPlugin: string;
    cplacePlugin: string;
}

export default class DocsBuilder {

    private static readonly allDocsDir = 'allDocs';

    private readonly workingDir: string;

    constructor(private readonly plugins: Map<string, string>, private readonly destination: string, private readonly useTypescript: boolean) {
        this.workingDir = DocsBuilder.createTemporaryWorkingDir();
        if (!this.destination) {
            this.destination = path.join(this.workingDir, 'out');
        }
    }

    public async start(): Promise<void> {
        ensureDirSync(this.destination);
        console.log(`Collecting docs from plugins... (useTypescript: ${this.useTypescript})`);
        this.copyDocsFromPlugins();
        const docsSource = this.getAllDocsPaths();

        let displayNameToPluginMap = new Map<string, string>();

        Object.keys(docsSource).forEach((plugin) => {
            const pathsForJsdoc: JsdocPaths = {
                cplacePlugin: plugin,
                sourceDir: docsSource[plugin],
                jsdocPlugin: require.resolve('../lib/cplaceJsdocPlugin'),
            };
            let metaData = this.buildForPlugin(plugin, pathsForJsdoc);
            if (!!metaData) {
                displayNameToPluginMap.set(metaData.displayName, plugin.replace(/\./g, '-').toLowerCase());
            }
        });

        if (this.useTypescript) {
            // Need to build the docs all in one go, buildForPlugin only prepares the data in the case using typescript
            console.log('Building docs using typedoc');
            let docsSourcePath = path.join(this.workingDir, DocsBuilder.allDocsDir);
            await this.buildTypedoc(docsSourcePath, this.destination);
            console.log('Finished building docs using typedoc');
            this.removeUnderscoresFromFilenames(this.destination);
            this.addAliasesAndFixLinks(this.destination, displayNameToPluginMap);
        }
    }

    async buildTypedoc(docsSourcePath: string, outputPath: string) {

        docsSourcePath = docsSourcePath.replace(/\\/g, '/');
        outputPath = outputPath.replace(/\\/g, '/');
        console.log(`Trying to generate Typedoc in ${docsSourcePath}, generate in ${outputPath}`);

        let tsconfigString = `{
            "compilerOptions": {
                "moduleDetection": "auto",
                "noEmit": true,
                "baseUrl": "./",
                "typeRoots": [
                    "./non_existent_or_empty_directory"
                ],
                "lib": ["ES2020"]
            },
            "include": [
                "${docsSourcePath}/*.d.ts"
            ],
        }`;

        fs.writeFileSync(path.resolve(docsSourcePath, 'tsconfig.json'), tsconfigString);

        let typedocConfigString = `{
            "$schema": "https://typedoc.org/schema.json",
            "entryPoints": [
              "${docsSourcePath}/*.d.ts"
            ],
            "out": "${outputPath}",
            "plugin": [
                "typedoc-plugin-markdown",
                "typedoc-hugo-theme",
                "cplace-typedoc-hugo-plugin"
            ],
            "excludePrivate": true,
            "skipErrorChecking": true,
            "theme": "hugo",
            "disableSources": true,
            "name": "Low-Code API"
        }`;
        fs.writeFileSync(path.resolve(docsSourcePath, 'typedoc.json'), typedocConfigString);

        let currentDir = process.cwd();
        process.chdir(docsSourcePath);
        console.log(`Changed cwd from ${currentDir} to ${process.cwd()}`);

        const TypeDoc = require('typedoc');

        const app = new TypeDoc.Application();

        let base = path.resolve(docsSourcePath);
        // If you want TypeDoc to load tsconfig.json / typedoc.json files
        app.options.addReader(new TypeDoc.TSConfigReader());
        app.options.addReader(new TypeDoc.TypeDocReader());

        await app.bootstrapWithPlugins();

        const project = app.convert();

        if (project) {
            // Project may not have converted correctly

            // Rendered docs
            await app.generateDocs(project, outputPath);

            console.log('Typedoc docs generated in folder: ' + outputPath);
        } else {
            console.error('Could not generate Typedoc docs');
            throw new Error('Could not generate Typedoc docs');
        }
        process.chdir(currentDir);
        console.log(`Changed cwd back to ${process.cwd()}`);
    }

    addAliasesAndFixLinks(directory: string, displayNameToPluginMap: Map<string, string>): void {
        console.log(`Adding aliases to *.md files in ${directory} and fix underscores in module names`);
        readdirSync(directory).forEach((fileName) => {
            const filePath = resolve(directory, fileName);
            // _index.ts file should stay intact
            if (lstatSync(filePath).isFile() && fileName !== '_index.md' && fileName.endsWith('.md')) {
                this.addAliasInFileAndFixLinks(filePath, fileName, displayNameToPluginMap);
            } else if (lstatSync(filePath).isDirectory()) {
                this.addAliasesAndFixLinks(filePath, displayNameToPluginMap);
            }
        });
     }

    addAliasInFileAndFixLinks(filePath: string, fileName: string, displayNameToPluginMap: Map<string, string>): void {
        let fileContent = readFileSync(filePath, {
            encoding: 'utf8',
        }).toString();

        let fileNameParts = fileName.split('.');
        let displayNamePart = fileNameParts[0];
        let mappedDisplayNamePart = displayNamePart.replace(/ /g, '_'); // Originally the file had underscores instead of blanks

        let mappedModuleName = displayNameToPluginMap.get(mappedDisplayNamePart);
        if (!!mappedModuleName) {
            let alias = '../'+mappedModuleName;
            if (fileNameParts.length > 2) {
                let detailName = fileNameParts[1].toLowerCase();
                alias = alias + '/' + detailName;
                console.log(`Adding alias to file ${filePath}: ${alias}`);
            }

            fileContent = fileContent.replace(/^---/, `---\naliases:\n- ${alias}`);
        }

        console.log(`Adjusting underscores in module names in file ${filePath}`);
        // Now replace all occurences of all module names (i.e. all the ones with underscore) with one containing
        // blanks instead (so that we display e.g. "Office reports" instead of "Office_reports" everywhere
        displayNameToPluginMap.forEach( (value: string, displayNameWithUnderscore: string, map: Map<string, string>) => {
            let displayNameWithoutUnderscore = displayNameWithUnderscore.replace(/_/g, ' ');
            let displayNameWithEscapedUnderscore = displayNameWithUnderscore.replace(/_/g, '\\\\_');
            fileContent = fileContent.replace(new RegExp(displayNameWithUnderscore, 'g'), displayNameWithoutUnderscore);
            fileContent = fileContent.replace(new RegExp(displayNameWithEscapedUnderscore, 'g'), displayNameWithoutUnderscore);
        } );

        writeFileSync(filePath, fileContent);
    }

    removeUnderscoresFromFilenames(directory: string): void {
        console.log(`Removing underscores from filenames is directory ${directory}`);
        readdirSync(directory).forEach((fileName) => {
            const filePath = resolve(directory, fileName);
            // _index.ts file should stay intact
            if (lstatSync(filePath).isFile() && fileName !== '_index.md'&& fileName.endsWith('.md')) {
                let newFilename = fileName.replace(/_/g, ' ');
                let newFilepath = resolve(directory, newFilename);
                fs.renameSync(filePath, newFilepath);
            } else if (lstatSync(filePath).isDirectory()) {
                this.removeUnderscoresFromFilenames(filePath);
            }
        });
    }

    buildForPlugin(plugin: string, jsdocPaths: JsdocPaths): PluginMetaData | undefined {
        // if plugin does not contain any js files return
        if (!this.containsLowCodeDocFiles(path.join(jsdocPaths.sourceDir, 'docs'))) {
            return undefined;
        }

        let metaData: PluginMetaData = DocsBuilder.getMetaData(jsdocPaths.sourceDir, plugin);
        if (!metaData.displayName) {
            console.error(`(CplaceJSDocs) Incorrect meta data cannot build docs for ${plugin}`);
            return undefined;
        }

        if (!this.useTypescript) {
            const outputPath = path.join(this.destination, plugin.replace(/\W+/gi, '-').toLowerCase());
            mkdirpSync(outputPath)

            const pluginFm = frontMatterTemplate(metaData.displayName);
            outputFileSync(path.join(outputPath, '_index.md'), pluginFm);

            let docsData = jsdoc2md.getTemplateDataSync({
                'no-cache': true,
                files: path.join(jsdocPaths.sourceDir, 'docs', '/**/*.js'),
            });

            // group different types of entities
            const groups = groupData(docsData);
            generateLinks(plugin, groups);

            Object.keys(groups).forEach((group) => {
                // typedefs are handled later
                if (group === 'typedef') {
                    return;
                }
                const templateClosure = DocsBuilder.getTemplateClosure(group);

                for (const entry of groups[group]) {
                    const template = templateClosure(entry);
                    debug(`rendering ${entry}`);
                    const output = jsdoc2md.renderSync({
                        data: docsData,
                        template: template,
                        helper: require.resolve('../dmd-ext/helper/helpers'),
                    });
                    const filePath = path.resolve(outputPath, `${entry.toLowerCase()}.md`);
                    fs.writeFileSync(filePath, output);
                    debug(`Written file:  ${filePath}`);
                }
            });

            // do it for global typedefs
            if (groups.typedef.size) {
                const templateClosure = DocsBuilder.getTemplateClosure('typedef');
                const template = templateClosure('Helper types');
                const output = jsdoc2md.renderSync({
                    data: docsData,
                    helper: require.resolve('../dmd-ext/helper/helpers'),
                    template: template,
                });
                fs.writeFileSync(path.resolve(outputPath, 'helper-types.md'), output);
            }
            console.log('Docs generated in folder: ' + outputPath);
        } else {
            metaData.displayName = metaData.displayName.replace(/ /g, '_');
            this.concatenateTypescriptDefinitions(path.resolve(jsdocPaths.sourceDir, 'docs'), metaData.displayName, ['globals.d.ts', 'cplace-extension.d.ts']);
        }
        return metaData;
    }

    private concatenateTypescriptDefinitions(pluginDocsPath: string, pluginName: string, excludeFiles: string[]): string {
        let outputFile = path.resolve(pluginDocsPath, '..', '..', pluginName+'.d.ts');

        console.log(`Concatenating *.d.ts files from directory ${pluginDocsPath} for plugin ${pluginName} to file ${outputFile} - excluded files are: ${excludeFiles}.`);

        let files = fs.readdirSync(pluginDocsPath);
        files.forEach(file => {
            let absoluteFile = path.resolve(pluginDocsPath, file);
            let stats = fs.lstatSync(absoluteFile);
            if (stats.isFile() && file.endsWith('.d.ts') && !excludeFiles.includes(file)) {
                console.log(`Adding contents of file ${file}`);
                let contents = fs.readFileSync(absoluteFile);
                fs.appendFileSync(outputFile, contents+'\n');
            } else {
                console.log(`Ignoring file ${file}`);
            }
        })
        return outputFile;
    }

    private copyDocsFromPlugins() {
        this.plugins.forEach((pluginPath, pluginName) => {
            const docsPath = path.join(pluginPath, 'assets', 'cplaceJS');
            const alternativeDocsPath = path.join(pluginPath, 'src', 'main', 'resources', 'cplaceJS');
            if (!this.useTypescript && DocsBuilder.canCopyDocs(docsPath)) {
                copySync(
                    docsPath,
                    path.join(this.workingDir, DocsBuilder.allDocsDir, pluginName)
                );
            } else if (DocsBuilder.canCopyDocs(alternativeDocsPath)) {
                copySync(
                    alternativeDocsPath,
                    path.join(this.workingDir, DocsBuilder.allDocsDir, pluginName)
                );
            }
        });
    }

    private static canCopyDocs(dir): boolean {
        return (existsSync(dir) && lstatSync(dir).isDirectory());
    }

    private containsLowCodeDocFiles(dir): boolean {
        if (!existsSync(dir)) {
            return false;
        }

        const files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {
            const filename = path.join(dir, files[i]);
            const stat = fs.lstatSync(filename);
            if (stat.isDirectory()) {
                if (this.containsLowCodeDocFiles(filename)) {
                    return true;
                }
            } else if ((this.useTypescript && filename.indexOf('.d.ts') >= 0) || (!this.useTypescript && filename.indexOf('.js') >= 0)) {
                return true;
            }
        }

        return false;
    }

    private getAllDocsPaths(): Object {
        const docsPaths = {};
        for (const pluginName of this.plugins.keys()) {
            docsPaths[pluginName] = path.join(this.workingDir, 'allDocs', pluginName);
        }
        return docsPaths;
    }

    private static getMetaData(dir: string, plugin: string): PluginMetaData {
        const file = path.resolve(dir, 'manifest.json');
        let data;
        if (fs.existsSync(file)) {
            data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        }

        if (!data || !data.displayName) {
            const shortName = plugin.split('.').pop();
            data = {
                pluginShortName: shortName,
                displayName: shortName,
            }
        }

        return data;
    }

    private static getTemplateClosure(type) {
        switch (type) {
            case 'clazz':
                return classTemplate;
            case 'namespace':
                return namespaceTemplate;
            case 'typedef':
                return typedefTemplate;
            default:
                return () => {
                    return '{{>docs}}';
                };
        }
    }

    static createTemporaryWorkingDir(): string {
        const osTempDir = os.tmpdir();
        const tmpDir = path.join(osTempDir, 'cplacejs-docs-builder');
        rimraf.sync(tmpDir);
        fs.mkdirSync(tmpDir);
        debug(`Using temp directory ${tmpDir}`);
        return tmpDir
    }
}


