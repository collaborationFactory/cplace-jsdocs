// create temporary working directory
import * as os from 'os';
import {debug} from '../utils';
import * as path from 'path';
import * as fs from 'fs';
import {existsSync} from 'fs';
import * as rimraf from 'rimraf';
import {copySync, ensureDirSync, mkdirpSync} from 'fs-extra';
import jsdoc2md from 'jsdoc-to-markdown';
import classTemplate from '../dmd-ext/templates/tmpl-class';
import namespaceTemplate from '../dmd-ext/templates/tmpl-namespace';
import typedefTemplate from '../dmd-ext/templates/tmpl-typedef';
import {generateLinks, groupData} from './BuilderUtils';
import '../dmd-ext/helper/helpers'

interface JsdocPaths {
    sourceDir: string;
    jsdocPlugin: string;
    cplacePlugin: string;
    out: string;
}

export default class DocsBuilder {

    private readonly workingDir: string;

    constructor(private readonly plugins: Map<string, string>, private readonly destination: string) {
        this.workingDir = DocsBuilder.createTemporaryWorkingDir();
    }

    static createTemporaryWorkingDir(): string {
        const osTempDir = os.tmpdir();
        const tmpDir = path.join(osTempDir, 'cplaceJS-docs-builder');
        rimraf.sync(tmpDir);
        fs.mkdirSync(tmpDir);
        debug(`Using temp directory ${tmpDir}`);
        return tmpDir
    }

    public async start(): Promise<void> {
        console.log('Collecting docs from plugins...');
        this.copyDocsFromPlugins();

        let destinationPath = path.join(this.workingDir, 'out');
        if (this.destination) {
            destinationPath = this.destination;
        }
        ensureDirSync(destinationPath);

        const docsSource = this.getAllDocsPaths();

        Object.keys(docsSource).forEach((plugin) => {
            const pathsForJsdoc: JsdocPaths = {
                cplacePlugin: plugin,
                sourceDir: docsSource[plugin],
                jsdocPlugin: require.resolve('../lib/cplaceJsdocPlugin'),
                out: destinationPath,
            };
            this.buildForPlugin(plugin, pathsForJsdoc);
        });
        console.log('Docs generated in folder: ' + destinationPath);
    }

    buildForPlugin(plugin: string, jsdocPaths: JsdocPaths) {
        // if plugin does not contain any js files return
        if (!DocsBuilder.containsJsFiles(path.join(jsdocPaths.sourceDir, 'docs'))) {
            return;
        }

        const outputPath = path.join(jsdocPaths.out, 'api', plugin);

        mkdirpSync(outputPath)

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
                debug(`rendering ${entry}, template: ${template}`);
                const output = jsdoc2md.renderSync({
                    data: docsData,
                    template: template,
                    helper: require.resolve('../dmd-ext/helper/helpers'),
                });
                fs.writeFileSync(path.resolve(outputPath, `${entry}.md`), output);
            }
        });

        // do it for global typedefs
        const templateClosure = DocsBuilder.getTemplateClosure('typedef');
        const template = templateClosure('Helper types');
        const output = jsdoc2md.renderSync({
            data: docsData,
            helper: require.resolve('../dmd-ext/helper/helpers'),
            template: template,
        });
        fs.writeFileSync(path.resolve(outputPath, 'helper-types.md'), output);
    }

    private copyDocsFromPlugins() {
        this.plugins.forEach((pluginPath, pluginName) => {
            copySync(
                path.join(pluginPath, 'assets', 'cplaceJS'),
                path.join(this.workingDir, 'allDocs', pluginName)
            );
        });
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
}


