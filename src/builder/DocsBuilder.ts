// create temporary working directory
import * as os from 'os';
import {debug} from '../utils';
import * as path from 'path';
import * as fs from 'fs';
import {existsSync, lstatSync} from 'fs';
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

interface JsdocPaths {
    sourceDir: string;
    jsdocPlugin: string;
    cplacePlugin: string;
}

export default class DocsBuilder {

    private static readonly allDocsDir = 'allDocs';

    private readonly workingDir: string;

    constructor(private readonly plugins: Map<string, string>, private readonly destination: string) {
        this.workingDir = DocsBuilder.createTemporaryWorkingDir();
        if (!this.destination) {
            this.destination = path.join(this.workingDir, 'out');
        }
    }

    public async start(): Promise<void> {
        ensureDirSync(this.destination);
        console.log('Collecting docs from plugins...');
        this.copyDocsFromPlugins();
        const docsSource = this.getAllDocsPaths();

        Object.keys(docsSource).forEach((plugin) => {
            const pathsForJsdoc: JsdocPaths = {
                cplacePlugin: plugin,
                sourceDir: docsSource[plugin],
                jsdocPlugin: require.resolve('../lib/cplaceJsdocPlugin'),
            };
            this.buildForPlugin(plugin, pathsForJsdoc);
        });
    }

    buildForPlugin(plugin: string, jsdocPaths: JsdocPaths) {
        // if plugin does not contain any js files return
        if (!DocsBuilder.containsJsFiles(path.join(jsdocPaths.sourceDir, 'docs'))) {
            return;
        }

        let metaData: PluginMetaData = DocsBuilder.getMetaData(jsdocPaths.sourceDir, plugin);
        if (!metaData.displayName) {
            console.error(`(CplaceJSDocs) Incorrect meta data cannot build docs for ${plugin}`);
            return;
        }

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
        if(groups.typedef.size) {
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
    }

    private copyDocsFromPlugins() {
        this.plugins.forEach((pluginPath, pluginName) => {
            const docsPath = path.join(pluginPath, 'assets', 'cplaceJS');
            const alternativeDocsPath = path.join(pluginPath, 'src', 'main', 'resources', 'cplaceJS');
            if (DocsBuilder.canCopyDocs(docsPath)) {
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

    private static containsJsFiles(dir): boolean {
        if (!existsSync(dir)) {
            return false;
        }

        const files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {
            const filename = path.join(dir, files[i]);
            const stat = fs.lstatSync(filename);
            if (stat.isDirectory()) {
                if (this.containsJsFiles(filename)) {
                    return true;
                }
            } else if (filename.indexOf('.js') >= 0) {
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


